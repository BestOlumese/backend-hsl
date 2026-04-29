import { v7 as uuidv7 } from "uuid";
import { parseNLQ } from "../utils/nlpParser.js";
import { getDb } from "../db/database.js";
import { fetchGenderPrediction } from "../services/genderize.service.js";
import { fetchAgePrediction } from "../services/agify.service.js";
import { fetchNationalityPrediction } from "../services/nationalize.service.js";
import {
  getAgeGroup,
  getHighestProbabilityCountry,
} from "../utils/classification.js";
import { getCountryName } from "../utils/countryMapping.js";

export const createProfile = async (req, res) => {
  try {
    const { name } = req.body;

    // Validate incoming name payload
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        status: "error",
        message: "Missing or empty name parameter",
      });
    }

    const normalizedName = name.trim().toLowerCase();

    const db = await getDb();

    // Check for an existing profile to handle idempotency
    const existing = await db.get(
      `SELECT * FROM profiles WHERE lower(name) = ?`,
      [normalizedName],
    );
    if (existing) {
      return res.status(200).json({
        status: "success",
        message: "Profile already exists",
        data: {
          id: existing.id,
          name: existing.name,
          gender: existing.gender,
          gender_probability: existing.gender_probability,
          age: existing.age,
          age_group: existing.age_group,
          country_id: existing.country_id,
          country_name: existing.country_name,
          country_probability: existing.country_probability,
          created_at: existing.created_at,
        },
      });
    }

    // Fetch all external predictions in parallel to optimize latency
    const [genderData, ageData, nationalityData] = await Promise.all([
      fetchGenderPrediction(normalizedName),
      fetchAgePrediction(normalizedName),
      fetchNationalityPrediction(normalizedName),
    ]);

    // Map external responses to our internal schema
    const ageGroup = getAgeGroup(ageData.age);
    const countryObj = getHighestProbabilityCountry(nationalityData.country);

    // Ensure we got a valid country fallback
    if (!countryObj) {
      throw {
        isExternalApiError: true,
        message: "Nationalize returned an invalid response",
      };
    }

    const newProfile = {
      id: uuidv7(),
      name: normalizedName,
      gender: genderData.gender,
      gender_probability: genderData.probability,
      sample_size: genderData.count,
      age: ageData.age,
      age_group: ageGroup,
      country_id: countryObj.country_id,
      country_name: getCountryName(countryObj.country_id),
      country_probability: countryObj.probability,
      created_at: new Date().toISOString(),
    };

    // Persist new profile to the database
    await db.run(
      `
      INSERT INTO profiles (
        id, name, gender, gender_probability, sample_size, age, age_group, country_id, country_name, country_probability, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        newProfile.id,
        newProfile.name,
        newProfile.gender,
        newProfile.gender_probability,
        newProfile.sample_size,
        newProfile.age,
        newProfile.age_group,
        newProfile.country_id,
        newProfile.country_name,
        newProfile.country_probability,
        newProfile.created_at,
      ],
    );

    // Respond with the newly created profile
    return res.status(201).json({
      status: "success",
      data: {
        id: newProfile.id,
        name: newProfile.name,
        gender: newProfile.gender,
        gender_probability: newProfile.gender_probability,
        age: newProfile.age,
        age_group: newProfile.age_group,
        country_id: newProfile.country_id,
        country_name: newProfile.country_name,
        country_probability: newProfile.country_probability,
        created_at: newProfile.created_at
      },
    });
  } catch (error) {
    console.error("API Error:", error.message);

    // Handle explicit API validation failures (e.g., gender: null)
    if (error.isExternalApiError) {
      return res.status(502).json({
        status: "error",
        message: error.message,
      });
    }

    // Catch generic network timeouts or axios issues gracefully
    if (error.response || error.request) {
      return res.status(502).json({
        status: "error",
        message: "External API returned an invalid response or timed out",
      });
    }

    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

export const getSingleProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();

    const profile = await db.get(`SELECT * FROM profiles WHERE id = ?`, [id]);

    if (!profile) {
      return res.status(404).json({
        status: "error",
        message: "Profile not found",
      });
    }

    return res.status(200).json({
      status: "success",
      data: profile,
    });
  } catch (error) {
    console.error("Get Profile Error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

export const getAllProfiles = async (req, res) => {
  try {
    const { 
      gender, country_id, age_group, 
      min_age, max_age, 
      min_gender_probability, min_country_probability,
      sort_by, order,
      page, limit
    } = req.query;

    const db = await getDb();

    let queryParams = [];
    let conditions = "";

    if (gender) {
      conditions += ` AND lower(gender) = ?`;
      queryParams.push(gender.toLowerCase());
    }

    if (country_id) {
      conditions += ` AND lower(country_id) = ?`;
      queryParams.push(country_id.toLowerCase());
    }

    if (age_group) {
      conditions += ` AND lower(age_group) = ?`;
      queryParams.push(age_group.toLowerCase());
    }

    if (min_age) {
       conditions += ` AND age >= ?`;
       queryParams.push(parseInt(min_age, 10));
    }

    if (max_age) {
       conditions += ` AND age <= ?`;
       queryParams.push(parseInt(max_age, 10));
    }

    if (min_gender_probability) {
       conditions += ` AND gender_probability >= ?`;
       queryParams.push(parseFloat(min_gender_probability));
    }

    if (min_country_probability) {
       conditions += ` AND country_probability >= ?`;
       queryParams.push(parseFloat(min_country_probability));
    }

    const countQuery = `SELECT count(*) as total FROM profiles WHERE 1=1` + conditions;
    let query = `SELECT * FROM profiles WHERE 1=1` + conditions;

    // Sorting
    const validSorts = ['age', 'created_at', 'gender_probability'];
    const validOrders = ['asc', 'desc'];
    
    if (sort_by && validSorts.includes(sort_by.toLowerCase())) {
       const sortOrder = (order && validOrders.includes(order.toLowerCase())) ? order.toLowerCase() : 'asc';
       query += ` ORDER BY ${sort_by.toLowerCase()} ${sortOrder}`;
    }

    // Pagination
    let currentPage = Math.max(1, parseInt(page, 10) || 1);
    let currentLimit = parseInt(limit, 10) || 10;
    if (currentLimit > 50) currentLimit = 50;

    const offset = (currentPage - 1) * currentLimit;

    query += ` LIMIT ? OFFSET ?`;

    const totalResult = await db.get(countQuery, queryParams);
    const total_records = totalResult ? totalResult.total : 0;
    const total_pages = Math.ceil(total_records / currentLimit);

    const profilesParams = [...queryParams, currentLimit, offset];
    const profiles = await db.all(query, profilesParams);

    const data = profiles.map((p) => ({
      id: p.id,
      name: p.name,
      gender: p.gender,
      gender_probability: p.gender_probability,
      age: p.age,
      age_group: p.age_group,
      country_id: p.country_id,
      country_name: p.country_name,
      country_probability: p.country_probability,
      created_at: p.created_at
    }));

    const baseUrl = '/api/profiles';
    const queryStr = req.originalUrl.includes('?') ? req.originalUrl.split('?')[1] : '';
    const params = new URLSearchParams(queryStr);
    
    params.set('page', currentPage);
    params.set('limit', currentLimit);
    const self = `${baseUrl}?${params.toString()}`;

    let next = null;
    if (currentPage < total_pages) {
      params.set('page', currentPage + 1);
      next = `${baseUrl}?${params.toString()}`;
    }

    let prev = null;
    if (currentPage > 1) {
      params.set('page', currentPage - 1);
      prev = `${baseUrl}?${params.toString()}`;
    }

    return res.status(200).json({
      status: "success",
      page: currentPage,
      limit: currentLimit,
      total: total_records,
      total_pages,
      links: {
        self,
        next,
        prev
      },
      data: data,
    });
  } catch (error) {
    console.error("Get All Profiles Error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

export const exportProfiles = async (req, res) => {
  try {
    const { format } = req.query;
    if (format !== 'csv') {
      return res.status(400).json({ status: 'error', message: 'Only CSV format is supported' });
    }

    const { 
      gender, country_id, age_group, 
      min_age, max_age, 
      sort_by, order
    } = req.query;

    const db = await getDb();
    let queryParams = [];
    let conditions = "";

    if (gender) {
      conditions += ` AND lower(gender) = ?`;
      queryParams.push(gender.toLowerCase());
    }
    if (country_id) {
      conditions += ` AND lower(country_id) = ?`;
      queryParams.push(country_id.toLowerCase());
    }
    if (age_group) {
      conditions += ` AND lower(age_group) = ?`;
      queryParams.push(age_group.toLowerCase());
    }
    if (min_age) {
       conditions += ` AND age >= ?`;
       queryParams.push(parseInt(min_age, 10));
    }
    if (max_age) {
       conditions += ` AND age <= ?`;
       queryParams.push(parseInt(max_age, 10));
    }

    let query = `SELECT id, name, gender, gender_probability, age, age_group, country_id, country_name, country_probability, created_at FROM profiles WHERE 1=1` + conditions;

    const validSorts = ['age', 'created_at'];
    if (sort_by && validSorts.includes(sort_by.toLowerCase())) {
       const sortOrder = (order && ['asc', 'desc'].includes(order.toLowerCase())) ? order.toLowerCase() : 'asc';
       query += ` ORDER BY ${sort_by.toLowerCase()} ${sortOrder}`;
    }

    const profiles = await db.all(query, queryParams);

    // CSV generation
    let csv = "id,name,gender,gender_probability,age,age_group,country_id,country_name,country_probability,created_at\n";
    profiles.forEach(p => {
      csv += `${p.id},${p.name},${p.gender},${p.gender_probability},${p.age},${p.age_group},${p.country_id},${p.country_name},${p.country_probability},${p.created_at}\n`;
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="profiles_${timestamp}.csv"`);
    return res.status(200).send(csv);

  } catch (error) {
    console.error("Export Error:", error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

export const searchProfiles = async (req, res) => {
  try {
      const { q, page, limit, sort_by, order } = req.query;
      if (!q) {
           return res.status(400).json({ 
               status: "error", 
               message: "Missing search query parameter 'q'" 
           });
      }
      
      const filters = parseNLQ(q);
      
      // Override req.query for standard getAllProfiles pipeline
      req.query = { 
          ...filters, 
          page, 
          limit,
          sort_by,
          order
      };
      
      return getAllProfiles(req, res);
  } catch (error) {
      console.error("Search Profiles Error:", error);
      return res.status(500).json({
          status: "error",
          message: "Internal server error"
      });
  }
};

export const deleteProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();

    // Proceed with a hard delete. Returning 204 regardless of prior existence works well for idempotent deletes.
    await db.run(`DELETE FROM profiles WHERE id = ?`, [id]);

    return res.status(204).send();
  } catch (error) {
    console.error("Delete Profile Error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

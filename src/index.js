import 'dotenv/config';
import app from "./app.js";

// Vercel serverless functions require the Express app to be exported directly.
// When running locally via 'node src/index.js', it will gracefully attach to the port.
if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;

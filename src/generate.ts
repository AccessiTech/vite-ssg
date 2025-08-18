import { generate } from "./";

(async () => {
  await generate()
    .catch((error) => {
      console.error("Error during static site generation:", error);
      process.exit(1);
    });
})();

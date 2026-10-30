import { validarCaso } from "./tools/oc";

for (let i = 1; i <= 6; i++) {
  const id = `sol-00${i}`;
  try {
    console.log("\n================================");
    console.log(JSON.stringify(validarCaso(id), null, 2));
  } catch (error) {
    console.error(`Error procesando ${id}:`, error);
  }
}

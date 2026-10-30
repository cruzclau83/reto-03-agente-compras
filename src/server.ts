import express from "express";
import path from "node:path";
import { validarCaso } from "./tools/oc";

const app = express();
app.use(express.json());
app.use(express.static(path.join(process.cwd(), "public")));

let ultimaValidacion: any = null;
let ordenes: any[] = [];

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, servicio: "Agente de compras Periferia IT" });
});

app.get("/api/casos", (_req, res) => {
  const casos = [];
  for (let i = 1; i <= 6; i++) {
    const id = `sol-00${i}`;
    try {
      casos.push(validarCaso(id));
    } catch {
      casos.push({ caso: id, estado: "ERROR", errores: ["No se pudo procesar"] });
    }
  }
  res.json(casos);
});

app.post("/api/validar", (req, res) => {
  try {
    const id = String(req.body.caso || "");
    if (!/^sol-00[1-6]$/.test(id)) {
      return res.status(400).json({ error: "Caso no válido. Usa sol-001 a sol-006." });
    }

    ultimaValidacion = validarCaso(id);
    res.json(ultimaValidacion);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Error de validación" });
  }
});

app.post("/api/confirmar", (_req, res) => {
  if (!ultimaValidacion) {
    return res.status(400).json({ error: "Primero debes validar una solicitud." });
  }

  if (ultimaValidacion.errores.length > 0) {
    return res.status(409).json({
      error: "La solicitud tiene controles incumplidos. No se puede crear la orden.",
      resultado: ultimaValidacion
    });
  }

  const existente = ordenes.find(o => o.solicitud === ultimaValidacion.solicitud);
  if (existente) {
    return res.status(409).json({ error: "Esta solicitud ya tiene una orden simulada.", orden: existente });
  }

  const orden = {
    numero: `OC-DEMO-${String(ordenes.length + 1).padStart(4, "0")}`,
    solicitud: ultimaValidacion.solicitud,
    proveedor: ultimaValidacion.proveedor,
    valor: ultimaValidacion.valor,
    aprobador: ultimaValidacion.aprobador,
    estado: "CREADA_EN_SIMULADOR",
    fecha: new Date().toISOString()
  };

  ordenes.push(orden);
  res.json({ mensaje: "Confirmación humana recibida. Orden simulada creada.", orden });
});

app.get("/api/ordenes", (_req, res) => res.json(ordenes));

const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => console.log(`Servidor disponible en http://localhost:${PORT}`));

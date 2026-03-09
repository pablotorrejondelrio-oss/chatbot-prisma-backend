import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { DirectoryLoader } from 'langchain/document_loaders/fs/directory';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import path from 'path';
import fs from 'fs';

dotenv.config();
const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const PORT = process.env.PORT || 3000;
let contextoGlobal = "";

async function prepararDocumentos() {
  console.log('Leyendo PDFs...');
  // Apuntar a la carpeta 'documents' subiendo un nivel o buscando localmente dependiendo de dónde se corra
  const docsPath = path.join(process.cwd(), '../documents');
  const fallbackDocsPath = path.join(process.cwd(), 'documents');
  
  let finalPath = fs.existsSync(docsPath) ? docsPath : fallbackDocsPath;
  
  if (!fs.existsSync(finalPath)) {
    console.warn(`[Aviso] No se encontró la carpeta de documentos en ${finalPath}`);
    return;
  }
  
  const loader = new DirectoryLoader(finalPath, { '.pdf': (p) => new PDFLoader(p) });

  try {
    const docs = await loader.load();
    // Juntamos todo el texto de los 7 PDFs en una sola variable
    contextoGlobal = docs.map(d => d.pageContent).join("\n\n").substring(0, 30000);
    console.log('¡PDFs leídos con éxito! El chat está listo.');
  } catch (e) {
    console.error('Error leyendo PDFs:', e);
  }
}

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  apiKey: process.env.GOOGLE_API_KEY,
  apiVersion: "v1beta"
});

app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  console.log(`\n--- NUEVO MENSAJE ---`);
  console.log(`[Usuario]: ${message}`);
  
  try {
    const prompt = `Eres el asistente de PRISMA. Usa este texto de nuestros documentos para responder:
    
    ${contextoGlobal}
    
    INSTRUCCIONES IMPORTANTES:
    1. Responde SIEMPRE de forma breve (máximo 2-3 frases).
    2. NO uses asteriscos, negritas, ni símbolos markdown molestos (solo texto limpio).
    3. Si el usuario pregunta algo que NO está en el texto proporcionado, DEBES decir exactamente: "Lo siento, para esa información específica es mejor que contactes con nuestro equipo directamente."
    4. Siempre que hables de Pablo, refiérete a él como el fundador de PRISMA.
    
    Pregunta del cliente: ${message}`;

    console.log(`Enviando consulta a Gemini...`);
    const response = await llm.invoke(prompt);
    console.log(`[Gemini]: Respuesta generada con éxito.`);
    
    res.json({ reply: response.content });
  } catch (error) {
    console.error('Error procesando el chat en el servidor:', error);
    res.status(500).json({ reply: "Lo siento, tengo un problema técnico. ¿Puedes repetir?" });
  }
});

prepararDocumentos().then(() => {
  app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));
});

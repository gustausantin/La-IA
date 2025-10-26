// Script temporal para corregir el workflow
const fs = require('fs');

// Leer el JSON actual
const workflowPath = './n8n/workflows/3-super-agent-hibrido-FINAL-CORREGIDO.json';
const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));

// CAMBIO 1: Añadir slot_duration al nodo "🔗 Fusionar Contexto Enriquecido"
const fusionarNode = workflow.nodes.find(n => n.name === '🔗 Fusionar Contexto Enriquecido');
if (fusionarNode) {
  // Buscar y reemplazar en el jsCode
  fusionarNode.parameters.jsCode = fusionarNode.parameters.jsCode.replace(
    `    settings: {
      reservation_duration: settings.reservation_duration || 90,
      max_party_size: bookingSettings.max_party_size || 8,`,
    `    settings: {
      reservation_duration: settings.reservation_duration || 90,
      slot_duration: settings.slot_duration || 30,
      max_party_size: bookingSettings.max_party_size || 8,`
  );
  console.log('✅ Cambio 1 aplicado: slot_duration añadido al contexto');
}

// CAMBIO 2: Actualizar prompt del Super Agent
const superAgentNode = workflow.nodes.find(n => n.name === '🤖 Super Agent (GPT-4o)');
if (superAgentNode) {
  let prompt = superAgentNode.parameters.options.systemMessage;
  
  // Añadir slot_duration a "Políticas"
  prompt = prompt.replace(
    `**Políticas:**
• Duración: {{ $json.restaurant_context.settings.reservation_duration }} min
• Máximo personas:`,
    `**Políticas:**
• Duración: {{ $json.restaurant_context.settings.reservation_duration }} min
• Intervalos de reserva: cada {{ $json.restaurant_context.settings.slot_duration }} min
• Máximo personas:`
  );
  
  // Añadir nota después de "Paso 2 → HORA"
  prompt = prompt.replace(
    `**Paso 2 → HORA**
Si no la tienes: "¿A qué hora prefieres?"
Si la tienes: Convierte a formato 24h (ej: "9 de la noche" = 21:00) y confirma.

**Paso 3 → PERSONAS**`,
    `**Paso 2 → HORA**
Si no la tienes: "¿A qué hora prefieres?"
Si la tienes: Convierte a formato 24h (ej: "9 de la noche" = 21:00) y confirma.

⚠️ **IMPORTANTE:** Las reservas son cada {{ $json.restaurant_context.settings.slot_duration }} minutos.
Puedes aceptar horas como: 14:00, 14:30, 15:00, 15:30, 20:00, 20:30, 21:00, 21:30, etc.

**Paso 3 → PERSONAS**`
  );
  
  superAgentNode.parameters.options.systemMessage = prompt;
  console.log('✅ Cambio 2 aplicado: prompt actualizado con slot_duration');
}

// Guardar el archivo actualizado
fs.writeFileSync(workflowPath, JSON.stringify(workflow, null, 2), 'utf8');
console.log('✅ Archivo guardado: 3-super-agent-hibrido-FINAL-CORREGIDO.json');
console.log('\n🎯 CAMBIOS APLICADOS QUIRÚRGICAMENTE:');
console.log('1. slot_duration añadido al restaurant_context.settings');
console.log('2. Prompt actualizado para mencionar intervalos de 30 min');


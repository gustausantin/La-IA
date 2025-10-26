/**
 * 🤖 CONVERSATIONAL AI ENGINE
 * Sistema de IA conversacional avanzado para La-IA
 */

import { log } from '../utils/logger';

class ConversationalAI {
  constructor() {
    this.models = {
      nlp: new NLPProcessor(),
      intentClassifier: new IntentClassifier(),
      responseGenerator: new ResponseGenerator(),
      contextManager: new ContextManager()
    };
    
    this.conversationHistory = new Map();
    this.knowledgeBase = new Map();
    this.learningData = [];
  }

  // === PROCESAMIENTO DE LENGUAJE NATURAL ===
  async processMessage(message, context = {}) {
    try {
      log.info('🗣️ Processing message with Conversational AI...');
      
      // Análisis NLP completo
      const nlpAnalysis = await this.models.nlp.analyze(message);
      
      // Clasificación de intención
      const intent = await this.models.intentClassifier.classify(
        message, 
        nlpAnalysis, 
        context
      );
      
      // Gestión de contexto
      const enrichedContext = await this.models.contextManager.updateContext(
        context, 
        intent, 
        nlpAnalysis
      );
      
      // Generación de respuesta
      const response = await this.models.responseGenerator.generate(
        intent,
        enrichedContext,
        nlpAnalysis
      );
      
      // Guardar en historial para aprendizaje
      this.saveConversationData(message, response, intent, enrichedContext);
      
      return {
        response: response.text,
        intent: intent.name,
        confidence: intent.confidence,
        entities: nlpAnalysis.entities,
        actions: response.actions,
        context: enrichedContext,
        suggestions: response.suggestions
      };
      
    } catch (error) {
      log.error('❌ Conversational AI processing failed:', error);
      return this.getFallbackResponse(message);
    }
  }

  // === CLASIFICACIÓN DE INTENCIONES AVANZADA ===
  async classifyIntent(message, context = {}) {
    const intents = {
      // Reservas
      'make_reservation': {
        patterns: [
          /quiero hacer una reserva/i,
          /reservar una mesa/i,
          /necesito una mesa/i,
          /disponibilidad/i
        ],
        entities: ['date', 'time', 'party_size', 'special_requests']
      },
      
      'cancel_reservation': {
        patterns: [
          /cancelar reserva/i,
          /anular la reserva/i,
          /no voy a ir/i
        ],
        entities: ['reservation_id', 'date', 'name']
      },
      
      'modify_reservation': {
        patterns: [
          /cambiar la reserva/i,
          /modificar/i,
          /mover la mesa/i
        ],
        entities: ['reservation_id', 'new_date', 'new_time', 'new_party_size']
      },
      
      // Información
      'restaurant_info': {
        patterns: [
          /horarios/i,
          /dónde están/i,
          /ubicación/i,
          /teléfono/i,
          /dirección/i
        ],
        entities: ['info_type']
      },
      
      'menu_inquiry': {
        patterns: [
          /menú/i,
          /carta/i,
          /qué tienen/i,
          /precios/i,
          /especialidades/i
        ],
        entities: ['dish_type', 'price_range', 'dietary_restrictions']
      },
      
      // Quejas y feedback
      'complaint': {
        patterns: [
          /queja/i,
          /problema/i,
          /mal servicio/i,
          /insatisfecho/i
        ],
        entities: ['complaint_type', 'severity', 'specific_issue']
      },
      
      'compliment': {
        patterns: [
          /excelente/i,
          /muy bueno/i,
          /felicitaciones/i,
          /increíble/i
        ],
        entities: ['aspect_praised', 'specific_staff']
      }
    };

    // Análisis de patrones con scoring
    let bestMatch = { name: 'unknown', confidence: 0 };
    
    for (const [intentName, intentData] of Object.entries(intents)) {
      let score = 0;
      
      for (const pattern of intentData.patterns) {
        if (pattern.test(message)) {
          score += 1;
        }
      }
      
      // Ajustar score por contexto
      if (context.previousIntent === intentName) {
        score += 0.3; // Continuidad conversacional
      }
      
      if (context.userProfile?.preferences?.includes(intentName)) {
        score += 0.2; // Preferencias del usuario
      }
      
      // Normalizar score
      const confidence = Math.min(score / intentData.patterns.length, 1);
      
      if (confidence > bestMatch.confidence) {
        bestMatch = {
          name: intentName,
          confidence,
          entities: intentData.entities
        };
      }
    }
    
    return bestMatch;
  }

  // === EXTRACCIÓN DE ENTIDADES ===
  async extractEntities(message, intent) {
    const entities = {};
    
    // Extraer fechas
    const dateRegex = /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})|(\d{1,2}\s+de\s+\w+)|(\w+\s+\d{1,2})/gi;
    const dateMatches = message.match(dateRegex);
    if (dateMatches) {
      entities.date = this.parseDate(dateMatches[0]);
    }
    
    // Extraer horarios
    const timeRegex = /(\d{1,2}:\d{2})|(\d{1,2}\s*(?:am|pm))/gi;
    const timeMatches = message.match(timeRegex);
    if (timeMatches) {
      entities.time = this.parseTime(timeMatches[0]);
    }
    
    // Extraer números (cantidad de personas)
    const numberRegex = /(\d+)\s*(?:personas?|comensales?|gente|pax)/gi;
    const numberMatches = message.match(numberRegex);
    if (numberMatches) {
      entities.party_size = parseInt(numberMatches[0]);
    }
    
    // Extraer nombres
    const nameRegex = /(?:mi nombre es|me llamo|soy)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)/gi;
    const nameMatches = message.match(nameRegex);
    if (nameMatches) {
      entities.customer_name = nameMatches[0].replace(/(?:mi nombre es|me llamo|soy)\s+/gi, '');
    }
    
    // Extraer preferencias dietéticas
    const dietaryRegex = /(?:vegetariano|vegano|sin gluten|celíaco|kosher|halal)/gi;
    const dietaryMatches = message.match(dietaryRegex);
    if (dietaryMatches) {
      entities.dietary_restrictions = dietaryMatches;
    }
    
    return entities;
  }

  // === GENERACIÓN DE RESPUESTAS INTELIGENTES ===
  async generateResponse(intent, entities, context) {
    const responses = {
      make_reservation: () => this.handleReservationRequest(entities, context),
      cancel_reservation: () => this.handleCancellation(entities, context),
      modify_reservation: () => this.handleModification(entities, context),
      restaurant_info: () => this.provideRestaurantInfo(entities, context),
      menu_inquiry: () => this.provideMenuInfo(entities, context),
      complaint: () => this.handleComplaint(entities, context),
      compliment: () => this.handleCompliment(entities, context),
      unknown: () => this.handleUnknownIntent(entities, context)
    };
    
    const handler = responses[intent.name] || responses.unknown;
    return await handler();
  }

  // === HANDLERS ESPECÍFICOS ===
  
  async handleReservationRequest(entities, context) {
    // Verificar información necesaria
    const missingInfo = this.checkMissingReservationInfo(entities);
    
    if (missingInfo.length > 0) {
      return {
        text: `Para hacer tu reserva necesito que me proporciones: ${missingInfo.join(', ')}. ¿Podrías darme esa información?`,
        actions: ['request_missing_info'],
        nextStep: 'collect_reservation_data',
        suggestions: this.generateReservationSuggestions(entities)
      };
    }
    
    // Verificar disponibilidad
    const availability = await this.checkAvailability(entities);
    
    if (availability.available) {
      return {
        text: `¡Perfecto! Puedo confirmar tu reserva para ${entities.party_size} personas el ${entities.date} a las ${entities.time}. ¿Confirmas la reserva?`,
        actions: ['confirm_reservation'],
        nextStep: 'await_confirmation',
        data: { 
          tentativeReservation: entities,
          availableSlots: availability.alternativeSlots 
        }
      };
    } else {
      return {
        text: `Lo siento, no tenemos disponibilidad para ${entities.party_size} personas el ${entities.date} a las ${entities.time}. Te puedo ofrecer estas alternativas: ${availability.alternatives.join(', ')}`,
        actions: ['offer_alternatives'],
        nextStep: 'select_alternative',
        suggestions: availability.alternatives
      };
    }
  }

  async handleComplaint(entities, context) {
    return {
      text: `Lamento mucho escuchar que has tenido una mala experiencia. Tu opinión es muy importante para nosotros. ¿Podrías contarme más detalles sobre lo que pasó para poder solucionarlo?`,
      actions: ['escalate_to_manager', 'collect_complaint_details'],
      nextStep: 'complaint_resolution',
      suggestions: [
        'Hablar con el gerente',
        'Dejar feedback detallado',
        'Solicitar compensación'
      ]
    };
  }

  async handleCompliment(entities, context) {
    return {
      text: `¡Muchísimas gracias por tus amables palabras! Nos alegra enormemente saber que disfrutaste tu experiencia. Compartiré tu feedback con todo el equipo. ¡Esperamos verte pronto de nuevo!`,
      actions: ['log_positive_feedback'],
      nextStep: 'conversation_closure',
      suggestions: [
        'Hacer otra reserva',
        'Ver nuestro menú',
        'Seguirnos en redes sociales'
      ]
    };
  }

  // === APRENDIZAJE CONTINUO ===
  async learnFromConversation(conversation) {
    try {
      log.info('🧠 Learning from conversation...');
      
      // Analizar patrones de éxito
      const successMetrics = this.calculateConversationSuccess(conversation);
      
      // Identificar áreas de mejora
      const improvements = this.identifyImprovements(conversation);
      
      // Actualizar base de conocimiento
      await this.updateKnowledgeBase(conversation, successMetrics);
      
      // Entrenar modelos
      if (this.learningData.length > 100) {
        await this.retrainModels();
      }
      
      log.info('✅ Conversation learning completed');
      
    } catch (error) {
      log.error('❌ Conversation learning failed:', error);
    }
  }

  // === PERSONALIZACIÓN ===
  async personalizeResponse(response, userProfile) {
    if (!userProfile) return response;
    
    // Adaptar tono según el perfil del usuario
    if (userProfile.preferredTone === 'formal') {
      response.text = this.makeFormal(response.text);
    } else if (userProfile.preferredTone === 'casual') {
      response.text = this.makeCasual(response.text);
    }
    
    // Incluir preferencias conocidas
    if (userProfile.dietaryRestrictions?.length > 0) {
      response.suggestions = response.suggestions?.filter(
        suggestion => this.matchesDietaryRestrictions(suggestion, userProfile.dietaryRestrictions)
      );
    }
    
    // Recordar visitas anteriores
    if (userProfile.lastVisit) {
      response.text += ` Por cierto, nos alegra tenerte de vuelta desde tu última visita.`;
    }
    
    return response;
  }

  // === ANÁLISIS DE SENTIMIENTOS ===
  async analyzeSentiment(message) {
    // Análisis de sentimientos simplificado
    const positiveWords = ['excelente', 'bueno', 'genial', 'perfecto', 'increíble', 'fantástico'];
    const negativeWords = ['malo', 'terrible', 'pésimo', 'horrible', 'awful', 'disgusto'];
    
    let sentiment = 0;
    const words = message.toLowerCase().split(/\s+/);
    
    words.forEach(word => {
      if (positiveWords.includes(word)) sentiment += 1;
      if (negativeWords.includes(word)) sentiment -= 1;
    });
    
    return {
      score: sentiment,
      label: sentiment > 0 ? 'positive' : sentiment < 0 ? 'negative' : 'neutral',
      confidence: Math.abs(sentiment) / words.length
    };
  }

  // === MÉTODOS AUXILIARES ===
  
  getFallbackResponse(message) {
    return {
      response: 'Disculpa, no estoy seguro de cómo ayudarte con eso. ¿Podrías reformular tu pregunta o decirme si necesitas hacer una reserva, información del restaurante, o algo más específico?',
      intent: 'fallback',
      confidence: 0.1,
      entities: {},
      actions: ['request_clarification'],
      suggestions: [
        'Hacer una reserva',
        'Ver el menú',
        'Información del restaurante',
        'Hablar con un humano'
      ]
    };
  }

  checkMissingReservationInfo(entities) {
    const required = ['date', 'time', 'party_size'];
    return required.filter(field => !entities[field]);
  }

  async checkAvailability(entities) {
    // Verificación de disponibilidad REAL - requiere datos de Supabase
    const isAvailable = false; // DESHABILITADO - REQUIERE INTEGRACIÓN REAL CON DISPONIBILIDADES
    
    return {
      available: isAvailable,
      alternatives: isAvailable ? [] : [
        `${entities.date} a las ${this.addHour(entities.time)}`,
        `${this.addDay(entities.date)} a las ${entities.time}`,
        `${entities.date} para ${entities.party_size - 1} personas`
      ],
      alternativeSlots: this.generateAlternativeSlots(entities)
    };
  }

  saveConversationData(message, response, intent, context) {
    this.learningData.push({
      timestamp: new Date().toISOString(),
      input: message,
      output: response,
      intent: intent,
      context: context,
      success: response.actions?.includes('successful_interaction') || false
    });
    
    // Mantener solo los últimos 1000 registros
    if (this.learningData.length > 1000) {
      this.learningData = this.learningData.slice(-1000);
    }
  }

  parseDate(dateString) {
    // Parsing básico de fechas en español
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    if (dateString.includes('hoy')) return today.toISOString().split('T')[0];
    if (dateString.includes('mañana')) return tomorrow.toISOString().split('T')[0];
    
    // Formato DD/MM/YYYY o similar
    return dateString; // Simplificado
  }

  parseTime(timeString) {
    // Parsing básico de horarios
    return timeString.replace(/\s+/g, '');
  }

  addHour(time) {
    // Agregar una hora al horario
    const [hours, minutes] = time.split(':');
    const newHour = (parseInt(hours) + 1) % 24;
    return `${newHour.toString().padStart(2, '0')}:${minutes}`;
  }

  addDay(date) {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }

  generateAlternativeSlots(entities) {
    // Generar horarios alternativos
    const baseTime = entities.time || '19:00';
    const [hours, minutes] = baseTime.split(':');
    const alternatives = [];
    
    // Generar 3 alternativas de horario
    for (let i = 1; i <= 3; i++) {
      const newHour = (parseInt(hours) + i) % 24;
      alternatives.push(`${newHour.toString().padStart(2, '0')}:${minutes}`);
    }
    
    return alternatives;
  }
}

// === CLASES AUXILIARES ===

class NLPProcessor {
  async analyze(text) {
    return {
      tokens: text.split(/\s+/),
      entities: {},
      sentiment: 0,
      language: 'es',
      confidence: 0.9
    };
  }
}

class IntentClassifier {
  async classify(message, nlpAnalysis, context) {
    // Implementación simplificada
    return {
      name: 'make_reservation',
      confidence: 0.8,
      entities: ['date', 'time', 'party_size']
    };
  }
}

class ResponseGenerator {
  async generate(intent, context, nlpAnalysis) {
    return {
      text: 'Respuesta generada por IA',
      actions: ['respond'],
      suggestions: []
    };
  }
}

class ContextManager {
  async updateContext(currentContext, intent, nlpAnalysis) {
    return {
      ...currentContext,
      lastIntent: intent.name,
      timestamp: new Date().toISOString()
    };
  }
}

// Instancia singleton
export const conversationalAI = new ConversationalAI();
export default ConversationalAI;

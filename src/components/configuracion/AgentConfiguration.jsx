import React, { useState, useCallback } from 'react';
import {
  Bot,
  Brain,
  Zap,
  MessageSquare,
  Timer,
  Target,
  Users,
  Activity,
  Sparkles,
  Settings,
  Save,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Volume2,
  Mic,
  Code,
  Sliders,
  Heart,
  Award,
  TrendingUp,
  UserCheck,
  Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';

const AgentConfiguration = React.memo(({ settings, onUpdate }) => {
  const [agentConfig, setAgentConfig] = useState({
    // Personalidad del agente
    personality: settings?.personality || {
      name: 'Sofia',
      tone: 'friendly',
      language_style: 'casual',
      empathy_level: 8,
      proactivity: 7,
      formality: 3,
    },

    // Capacidades
    capabilities: settings?.capabilities || {
      can_make_reservations: true,
      can_modify_reservations: true,
      can_cancel_reservations: true,
      can_provide_menu_info: true,
      can_suggest_alternatives: true,
      can_handle_complaints: true,
      can_upsell: true,
      can_collect_feedback: true,
    },

    // Configuración de respuestas
    response_settings: settings?.response_settings || {
      max_response_time: 30,
      use_typing_indicator: true,
      response_length: 'medium',
      include_emojis: true,
      personalization_level: 'high',
    },

    // Reglas de escalamiento
    escalation_rules: settings?.escalation_rules || {
      complex_requests: true,
      customer_frustration: true,
      technical_issues: true,
      special_occasions: true,
      vip_customers: true,
      after_hours: false,
    },

    // Conocimiento del restaurante
    restaurant_knowledge: settings?.restaurant_knowledge || {
      menu_expertise: 9,
      allergy_awareness: 10,
      wine_knowledge: 7,
      local_recommendations: 8,
      dietary_restrictions: 9,
    },

    // Métricas objetivo
    target_metrics: settings?.target_metrics || {
      response_time: 1.5,
      customer_satisfaction: 4.5,
      conversion_rate: 30,
      resolution_rate: 85,
      escalation_rate: 15,
    },
  });

  const [activeTab, setActiveTab] = useState('personality');
  const [isLoading, setIsLoading] = useState(false);

  const handleNestedChange = useCallback((parent, field, value) => {
    setAgentConfig(prev => ({
      ...prev,
      [parent]: { ...prev[parent], [field]: value }
    }));
  }, []);

  const handleSave = useCallback(async () => {
    setIsLoading(true);
    try {
      await onUpdate({ agent_config: agentConfig });
      toast.success('Configuración del agente guardada');
    } catch (error) {
      toast.error('Error al guardar la configuración');
    } finally {
      setIsLoading(false);
    }
  }, [agentConfig, onUpdate]);

  const SliderField = ({ label, value, onChange, min = 0, max = 10, help }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <span className="text-sm font-bold text-purple-600">{value}/{max}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
      />
      {help && <p className="text-xs text-gray-500">{help}</p>}
    </div>
  );

  const ToggleField = ({ label, checked, onChange, help }) => (
    <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
      <div className="flex-1">
        <div className="font-medium text-gray-900">{label}</div>
        {help && <div className="text-sm text-gray-600">{help}</div>}
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
      </label>
    </div>
  );

  const SelectField = ({ label, value, onChange, options }) => (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );

  const MetricCard = ({ icon: Icon, label, current, target, unit = '', color = 'blue' }) => (
    <div className="bg-white p-2 rounded-lg border border-gray-200">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 bg-${color}-100 rounded-lg`}>
          <Icon className={`w-4 h-4 text-${color}-600`} />
        </div>
        <div className="flex-1">
          <div className="font-medium text-gray-900">{label}</div>
          <div className="text-sm text-gray-600">Actual: {current}{unit} | Objetivo: {target}{unit}</div>
        </div>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className={`bg-${color}-500 h-2 rounded-full transition-all duration-500`}
          style={{ width: `${Math.min((current / target) * 100, 100)}%` }}
        />
      </div>
    </div>
  );

  const tabs = [
    { id: 'personality', label: 'Personalidad', icon: Heart },
    { id: 'capabilities', label: 'Capacidades', icon: Zap },
    { id: 'responses', label: 'Respuestas', icon: MessageSquare },
    { id: 'escalation', label: 'Escalamiento', icon: AlertTriangle },
    { id: 'knowledge', label: 'Conocimiento', icon: Brain },
    { id: 'metrics', label: 'Métricas', icon: Target },
  ];

  const toneOptions = [
    { value: 'professional', label: 'Profesional' },
    { value: 'friendly', label: 'Amigable' },
    { value: 'casual', label: 'Casual' },
    { value: 'enthusiastic', label: 'Entusiasta' },
    { value: 'elegant', label: 'Elegante' },
  ];

  const languageStyleOptions = [
    { value: 'formal', label: 'Formal' },
    { value: 'casual', label: 'Casual' },
    { value: 'conversational', label: 'Conversacional' },
    { value: 'technical', label: 'Técnico' },
  ];

  const responseLengthOptions = [
    { value: 'short', label: 'Cortas' },
    { value: 'medium', label: 'Medianas' },
    { value: 'long', label: 'Largas' },
    { value: 'adaptive', label: 'Adaptativas' },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Bot className="w-5 h-5 text-purple-600" />
          Configuración del Agente IA
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          Personaliza el comportamiento y capacidades de tu asistente inteligente
        </p>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-6">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex-shrink-0 py-2 px-3 text-sm font-medium rounded transition-colors flex items-center gap-2
                ${activeTab === tab.id
                  ? 'bg-white text-purple-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
                }
              `}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'personality' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Nombre del Agente</label>
                <input
                  type="text"
                  value={agentConfig.personality.name}
                  onChange={(e) => handleNestedChange('personality', 'name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Sofia"
                />
              </div>

              <SelectField
                label="Tono de Comunicación"
                value={agentConfig.personality.tone}
                onChange={(value) => handleNestedChange('personality', 'tone', value)}
                options={toneOptions}
              />
            </div>

            <SelectField
              label="Estilo de Lenguaje"
              value={agentConfig.personality.language_style}
              onChange={(value) => handleNestedChange('personality', 'language_style', value)}
              options={languageStyleOptions}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <SliderField
                label="Nivel de Empatía"
                value={agentConfig.personality.empathy_level}
                onChange={(value) => handleNestedChange('personality', 'empathy_level', value)}
                help="Qué tan comprensivo es el agente"
              />

              <SliderField
                label="Proactividad"
                value={agentConfig.personality.proactivity}
                onChange={(value) => handleNestedChange('personality', 'proactivity', value)}
                help="Iniciativa para ofrecer ayuda"
              />

              <SliderField
                label="Formalidad"
                value={agentConfig.personality.formality}
                onChange={(value) => handleNestedChange('personality', 'formality', value)}
                help="Nivel de protocolo en el trato"
              />
            </div>
          </div>
        )}

        {activeTab === 'capabilities' && (
          <div className="space-y-4">
            <ToggleField
              label="Realizar Reservas"
              checked={agentConfig.capabilities.can_make_reservations}
              onChange={(value) => handleNestedChange('capabilities', 'can_make_reservations', value)}
              help="Permitir que el agente tome reservas directamente"
            />

            <ToggleField
              label="Modificar Reservas"
              checked={agentConfig.capabilities.can_modify_reservations}
              onChange={(value) => handleNestedChange('capabilities', 'can_modify_reservations', value)}
              help="Cambiar fecha, hora o número de personas"
            />

            <ToggleField
              label="Cancelar Reservas"
              checked={agentConfig.capabilities.can_cancel_reservations}
              onChange={(value) => handleNestedChange('capabilities', 'can_cancel_reservations', value)}
              help="Procesar cancelaciones siguiendo la política"
            />

            <ToggleField
              label="Información del Menú"
              checked={agentConfig.capabilities.can_provide_menu_info}
              onChange={(value) => handleNestedChange('capabilities', 'can_provide_menu_info', value)}
              help="Responder preguntas sobre platos y bebidas"
            />

            <ToggleField
              label="Sugerir Alternativas"
              checked={agentConfig.capabilities.can_suggest_alternatives}
              onChange={(value) => handleNestedChange('capabilities', 'can_suggest_alternatives', value)}
              help="Ofrecer opciones cuando no hay disponibilidad"
            />

            <ToggleField
              label="Gestionar Quejas"
              checked={agentConfig.capabilities.can_handle_complaints}
              onChange={(value) => handleNestedChange('capabilities', 'can_handle_complaints', value)}
              help="Manejar situaciones de insatisfacción"
            />

            <ToggleField
              label="Venta Adicional"
              checked={agentConfig.capabilities.can_upsell}
              onChange={(value) => handleNestedChange('capabilities', 'can_upsell', value)}
              help="Sugerir aperitivos, postres o bebidas"
            />

            <ToggleField
              label="Recopilar Feedback"
              checked={agentConfig.capabilities.can_collect_feedback}
              onChange={(value) => handleNestedChange('capabilities', 'can_collect_feedback', value)}
              help="Solicitar valoraciones y comentarios"
            />
          </div>
        )}

        {activeTab === 'responses' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Tiempo Máximo de Respuesta (segundos)</label>
                <input
                  type="number"
                  value={agentConfig.response_settings.max_response_time}
                  onChange={(e) => handleNestedChange('response_settings', 'max_response_time', parseInt(e.target.value) || 30)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  min="5"
                  max="300"
                />
              </div>

              <SelectField
                label="Longitud de Respuestas"
                value={agentConfig.response_settings.response_length}
                onChange={(value) => handleNestedChange('response_settings', 'response_length', value)}
                options={responseLengthOptions}
              />
            </div>

            <div className="space-y-4">
              <ToggleField
                label="Indicador de Escritura"
                checked={agentConfig.response_settings.use_typing_indicator}
                onChange={(value) => handleNestedChange('response_settings', 'use_typing_indicator', value)}
                help="Mostrar que el agente está escribiendo"
              />

              <ToggleField
                label="Usar Emojis"
                checked={agentConfig.response_settings.include_emojis}
                onChange={(value) => handleNestedChange('response_settings', 'include_emojis', value)}
                help="Incluir emojis apropiados en las respuestas"
              />
            </div>

            <SelectField
              label="Nivel de Personalización"
              value={agentConfig.response_settings.personalization_level}
              onChange={(value) => handleNestedChange('response_settings', 'personalization_level', value)}
              options={[
                { value: 'low', label: 'Bajo - Respuestas estándar' },
                { value: 'medium', label: 'Medio - Personalización básica' },
                { value: 'high', label: 'Alto - Altamente personalizado' },
              ]}
            />
          </div>
        )}

        {activeTab === 'escalation' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              <h4 className="font-medium text-gray-900">Condiciones de Escalamiento a Humano</h4>
            </div>

            <ToggleField
              label="Solicitudes Complejas"
              checked={agentConfig.escalation_rules.complex_requests}
              onChange={(value) => handleNestedChange('escalation_rules', 'complex_requests', value)}
              help="Eventos especiales, grupos grandes, requisitos específicos"
            />

            <ToggleField
              label="Frustración del Cliente"
              checked={agentConfig.escalation_rules.customer_frustration}
              onChange={(value) => handleNestedChange('escalation_rules', 'customer_frustration', value)}
              help="Detectar signos de insatisfacción o enojo"
            />

            <ToggleField
              label="Problemas Técnicos"
              checked={agentConfig.escalation_rules.technical_issues}
              onChange={(value) => handleNestedChange('escalation_rules', 'technical_issues', value)}
              help="Fallos del sistema o errores de procesamiento"
            />

            <ToggleField
              label="Ocasiones Especiales"
              checked={agentConfig.escalation_rules.special_occasions}
              onChange={(value) => handleNestedChange('escalation_rules', 'special_occasions', value)}
              help="Aniversarios, cumpleaños, celebraciones importantes"
            />

            <ToggleField
              label="Clientes VIP"
              checked={agentConfig.escalation_rules.vip_customers}
              onChange={(value) => handleNestedChange('escalation_rules', 'vip_customers', value)}
              help="Clientes premium o de alto valor"
            />

            <ToggleField
              label="Fuera de Horario"
              checked={agentConfig.escalation_rules.after_hours}
              onChange={(value) => handleNestedChange('escalation_rules', 'after_hours', value)}
              help="Escalamiento automático cuando el restaurante está cerrado"
            />
          </div>
        )}

        {activeTab === 'knowledge' && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="w-5 h-5 text-purple-500" />
              <h4 className="font-medium text-gray-900">Nivel de Conocimiento por Área</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SliderField
                label="Expertise en Menú"
                value={agentConfig.restaurant_knowledge.menu_expertise}
                onChange={(value) => handleNestedChange('restaurant_knowledge', 'menu_expertise', value)}
                help="Conocimiento detallado de platos y preparaciones"
              />

              <SliderField
                label="Conciencia de Alergias"
                value={agentConfig.restaurant_knowledge.allergy_awareness}
                onChange={(value) => handleNestedChange('restaurant_knowledge', 'allergy_awareness', value)}
                help="Identificación de alérgenos y restricciones"
              />

              <SliderField
                label="Conocimiento de Vinos"
                value={agentConfig.restaurant_knowledge.wine_knowledge}
                onChange={(value) => handleNestedChange('restaurant_knowledge', 'wine_knowledge', value)}
                help="Maridajes y recomendaciones de bebidas"
              />

              <SliderField
                label="Recomendaciones Locales"
                value={agentConfig.restaurant_knowledge.local_recommendations}
                onChange={(value) => handleNestedChange('restaurant_knowledge', 'local_recommendations', value)}
                help="Información sobre la zona y atracciones"
              />

              <SliderField
                label="Restricciones Dietéticas"
                value={agentConfig.restaurant_knowledge.dietary_restrictions}
                onChange={(value) => handleNestedChange('restaurant_knowledge', 'dietary_restrictions', value)}
                help="Opciones veganas, vegetarianas, sin gluten, etc."
              />
            </div>
          </div>
        )}

        {activeTab === 'metrics' && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-green-500" />
              <h4 className="font-medium text-gray-900">Objetivos de Rendimiento</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <MetricCard
                icon={Clock}
                label="Tiempo de Respuesta"
                current={1.2}
                target={agentConfig.target_metrics.response_time}
                unit="min"
                color="blue"
              />

              <MetricCard
                icon={UserCheck}
                label="Satisfacción del Cliente"
                current={0}
                target={agentConfig.target_metrics.customer_satisfaction}
                unit="/5"
                color="green"
              />

              <MetricCard
                icon={TrendingUp}
                label="Tasa de Conversión"
                current={28.5}
                target={agentConfig.target_metrics.conversion_rate}
                unit="%"
                color="purple"
              />

              <MetricCard
                icon={CheckCircle}
                label="Tasa de Resolución"
                current={92}
                target={agentConfig.target_metrics.resolution_rate}
                unit="%"
                color="green"
              />

              <MetricCard
                icon={AlertTriangle}
                label="Tasa de Escalamiento"
                current={12}
                target={agentConfig.target_metrics.escalation_rate}
                unit="%"
                color="orange"
              />
            </div>

            <div className="bg-purple-50 p-2 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                <h5 className="font-medium text-purple-900">Rendimiento Actual</h5>
              </div>
              <p className="text-sm text-purple-700">
                El agente está superando los objetivos en la mayoría de métricas. 
                Considera ajustar las metas para optimizar aún más el rendimiento.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            <Activity className="w-4 h-4 inline mr-1 text-green-500" />
            Agente activo y aprendiendo
          </div>
          
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Guardar Configuración
          </button>
        </div>
      </div>
    </div>
  );
});

AgentConfiguration.displayName = 'AgentConfiguration';

export default AgentConfiguration;

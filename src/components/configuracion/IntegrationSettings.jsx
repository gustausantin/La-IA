import React, { useState, useCallback } from 'react';
import {
  Webhook,
  Key,
  Code,
  Database,
  Wifi,
  WifiOff,
  ExternalLink,
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Settings,
  Save,
  Plus,
  Trash2,
  Edit,
  Zap,
  MessageSquare,
  PhoneCall,
  Mail,
  Globe,
  Bot,
  CreditCard,
  BarChart3,
} from 'lucide-react';
import toast from 'react-hot-toast';

const IntegrationSettings = React.memo(({ settings, onUpdate }) => {
  const [integrations, setIntegrations] = useState({
    webhooks: settings?.webhooks || [],
    api_keys: settings?.api_keys || {},
    channels: settings?.channels || {
      whatsapp: { enabled: true, config: {} },
      email: { enabled: true, config: {} },
      web: { enabled: true, config: {} },
      phone: { enabled: false, config: {} },
    },
    external_services: settings?.external_services || {
      google_calendar: { enabled: false, config: {} },
      mailchimp: { enabled: false, config: {} },
      stripe: { enabled: false, config: {} },
      analytics: { enabled: true, config: {} },
    }
  });

  const [activeTab, setActiveTab] = useState('channels');
  const [isLoading, setIsLoading] = useState(false);
  const [showSecrets, setShowSecrets] = useState({});

  const handleSave = useCallback(async () => {
    setIsLoading(true);
    try {
      await onUpdate({ integrations });
      toast.success('Integraciones guardadas correctamente');
    } catch (error) {
      toast.error('Error al guardar las integraciones');
    } finally {
      setIsLoading(false);
    }
  }, [integrations, onUpdate]);

  const toggleSecret = useCallback((key) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const addWebhook = useCallback(() => {
    const newWebhook = {
      id: Date.now().toString(),
      name: 'Nuevo Webhook',
      url: '',
      events: [],
      active: true,
      created_at: new Date().toISOString(),
    };
    setIntegrations(prev => ({
      ...prev,
      webhooks: [...prev.webhooks, newWebhook]
    }));
  }, []);

  const updateWebhook = useCallback((id, updates) => {
    setIntegrations(prev => ({
      ...prev,
      webhooks: prev.webhooks.map(webhook => 
        webhook.id === id ? { ...webhook, ...updates } : webhook
      )
    }));
  }, []);

  const deleteWebhook = useCallback((id) => {
    setIntegrations(prev => ({
      ...prev,
      webhooks: prev.webhooks.filter(webhook => webhook.id !== id)
    }));
    toast.success('Webhook eliminado');
  }, []);

  const toggleChannel = useCallback((channel, enabled) => {
    setIntegrations(prev => ({
      ...prev,
      channels: {
        ...prev.channels,
        [channel]: { ...prev.channels[channel], enabled }
      }
    }));
  }, []);

  const toggleService = useCallback((service, enabled) => {
    setIntegrations(prev => ({
      ...prev,
      external_services: {
        ...prev.external_services,
        [service]: { ...prev.external_services[service], enabled }
      }
    }));
  }, []);

  const testConnection = useCallback(async (type, config) => {
    toast.loading('Probando conexión...');
    // Simular test de conexión
    setTimeout(() => {
      toast.dismiss();
      toast.success(`Conexión ${type} exitosa`);
    }, 2000);
  }, []);

  const copyToClipboard = useCallback((text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado al portapapeles');
  }, []);

  const WebhookCard = ({ webhook }) => (
    <div className="border border-gray-200 rounded-lg p-2">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${webhook.active ? 'bg-green-500' : 'bg-gray-400'}`} />
          <input
            type="text"
            value={webhook.name}
            onChange={(e) => updateWebhook(webhook.id, { name: e.target.value })}
            className="font-medium text-gray-900 bg-transparent border-none p-0 focus:ring-0"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => updateWebhook(webhook.id, { active: !webhook.active })}
            className={`px-2 py-1 text-xs rounded ${
              webhook.active 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {webhook.active ? 'Activo' : 'Inactivo'}
          </button>
          <button
            onClick={() => deleteWebhook(webhook.id)}
            className="p-1 text-red-600 hover:bg-red-50 rounded"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">URL del Webhook</label>
          <div className="flex gap-2">
            <input
              type="url"
              value={webhook.url}
              onChange={(e) => updateWebhook(webhook.id, { url: e.target.value })}
              placeholder="https://tu-servidor.com/webhook"
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <button
              onClick={() => testConnection('webhook', webhook)}
              className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
            >
              Test
            </button>
          </div>
        </div>
        
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Eventos</label>
          <div className="flex flex-wrap gap-1">
            {['reserva_creada', 'reserva_modificada', 'reserva_cancelada', 'mensaje_recibido'].map(event => (
              <button
                key={event}
                onClick={() => {
                  const events = webhook.events.includes(event)
                    ? webhook.events.filter(e => e !== event)
                    : [...webhook.events, event];
                  updateWebhook(webhook.id, { events });
                }}
                className={`px-2 py-1 text-xs rounded ${
                  webhook.events.includes(event)
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {event}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const ChannelCard = ({ channel, config, enabled }) => {
    const icons = {
      whatsapp: MessageSquare,
      email: Mail,
      phone: PhoneCall,
      web: Globe,
    };
    
    const Icon = icons[channel] || Globe;
    const channelNames = {
      whatsapp: 'WhatsApp',
      email: 'Email',
      phone: 'Teléfono',
      web: 'Web',
    };

    return (
      <div className="border border-gray-200 rounded-lg p-2">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${enabled ? 'bg-green-100' : 'bg-gray-100'}`}>
              <Icon className={`w-5 h-5 ${enabled ? 'text-green-600' : 'text-gray-600'}`} />
            </div>
            <div>
              <h4 className="font-medium text-gray-900">{channelNames[channel]}</h4>
              <p className="text-sm text-gray-600">
                {enabled ? 'Configurado y activo' : 'Deshabilitado'}
              </p>
            </div>
          </div>
          
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => toggleChannel(channel, e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>
        
        {enabled && (
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <button
              onClick={() => testConnection(channel, config)}
              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
            >
              <Zap className="w-4 h-4" />
              Probar conexión
            </button>
          </div>
        )}
      </div>
    );
  };

  const ServiceCard = ({ service, config, enabled }) => {
    const serviceInfo = {
      google_calendar: { 
        name: 'Google Calendar', 
        icon: Calendar, 
        description: 'Sincronización de reservas con calendario' 
      },
      mailchimp: { 
        name: 'Mailchimp', 
        icon: Mail, 
        description: 'Marketing por email automatizado' 
      },
      stripe: { 
        name: 'Stripe', 
        icon: CreditCard, 
        description: 'Procesamiento de pagos' 
      },
      analytics: { 
        name: 'Google Analytics', 
        icon: BarChart3, 
        description: 'Seguimiento y métricas web' 
      },
    };

    const info = serviceInfo[service];
    const Icon = info?.icon || Settings;

    return (
      <div className="border border-gray-200 rounded-lg p-2">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${enabled ? 'bg-blue-100' : 'bg-gray-100'}`}>
              <Icon className={`w-5 h-5 ${enabled ? 'text-blue-600' : 'text-gray-600'}`} />
            </div>
            <div>
              <h4 className="font-medium text-gray-900">{info?.name}</h4>
              <p className="text-sm text-gray-600">{info?.description}</p>
            </div>
          </div>
          
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => toggleService(service, e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>
    );
  };

  const tabs = [
    { id: 'channels', label: 'Canales', icon: MessageSquare },
    { id: 'webhooks', label: 'Webhooks', icon: Webhook },
    { id: 'services', label: 'Servicios', icon: ExternalLink },
    { id: 'api', label: 'APIs', icon: Key },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Zap className="w-5 h-5 text-blue-600" />
          Integraciones y APIs
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          Conecta tu restaurante con servicios externos y webhooks
        </p>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-6">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex-1 py-2 px-3 text-sm font-medium rounded transition-colors flex items-center justify-center gap-2
                ${activeTab === tab.id
                  ? 'bg-white text-blue-600 shadow-sm'
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
        {activeTab === 'channels' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-gray-900">Canales de Comunicación</h4>
              <div className="text-sm text-gray-600">
                {Object.values(integrations.channels).filter(c => c.enabled).length} activos
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(integrations.channels).map(([channel, config]) => (
                <ChannelCard
                  key={channel}
                  channel={channel}
                  config={config.config}
                  enabled={config.enabled}
                />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'webhooks' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-gray-900">Webhooks Configurados</h4>
              <button
                onClick={addWebhook}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Nuevo Webhook
              </button>
            </div>
            
            {integrations.webhooks.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Webhook className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No hay webhooks configurados</p>
                <p className="text-sm">Agrega uno para recibir notificaciones en tiempo real</p>
              </div>
            ) : (
              <div className="space-y-4">
                {integrations.webhooks.map((webhook) => (
                  <WebhookCard key={webhook.id} webhook={webhook} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'services' && (
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 mb-4">Servicios Externos</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(integrations.external_services).map(([service, config]) => (
                <ServiceCard
                  key={service}
                  service={service}
                  config={config.config}
                  enabled={config.enabled}
                />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'api' && (
          <div className="space-y-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-4">Claves de API</h4>
              
              <div className="space-y-4">
                <div className="border border-gray-200 rounded-lg p-2">
                  <div className="flex items-center justify-between mb-2">
                    <label className="font-medium text-gray-900">API Key del Restaurante</label>
                    <button
                      onClick={() => copyToClipboard('sk_rest_' + Math.random().toString(36).substr(2, 9))}
                      className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                    >
                      <Copy className="w-4 h-4" />
                      Copiar
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <code className="flex-1 px-3 py-2 bg-gray-50 rounded font-mono text-sm">
                      {showSecrets.apiKey ? 'sk_rest_abc123xyz789' : '••••••••••••••••'}
                    </code>
                    <button
                      onClick={() => toggleSecret('apiKey')}
                      className="px-3 py-2 border border-gray-300 rounded hover:bg-gray-50"
                    >
                      {showSecrets.apiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Úsala para integraciones con tu sistema de reservas
                  </p>
                </div>

                <div className="border border-gray-200 rounded-lg p-2">
                  <div className="flex items-center justify-between mb-2">
                    <label className="font-medium text-gray-900">Webhook Secret</label>
                    <button
                      onClick={() => copyToClipboard('whsec_' + Math.random().toString(36).substr(2, 9))}
                      className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                    >
                      <Copy className="w-4 h-4" />
                      Copiar
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <code className="flex-1 px-3 py-2 bg-gray-50 rounded font-mono text-sm">
                      {showSecrets.webhookSecret ? 'whsec_def456uvw012' : '••••••••••••••••'}
                    </code>
                    <button
                      onClick={() => toggleSecret('webhookSecret')}
                      className="px-3 py-2 border border-gray-300 rounded hover:bg-gray-50"
                    >
                      {showSecrets.webhookSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Para verificar la autenticidad de los webhooks
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 p-2 rounded-lg">
              <div className="flex items-start gap-3">
                <Database className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h5 className="font-medium text-blue-900 mb-1">Documentación de API</h5>
                  <p className="text-sm text-blue-700 mb-2">
                    Consulta nuestra documentación completa para integrar con tu sistema.
                  </p>
                  <a
                    href="#"
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                  >
                    Ver documentación
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            <CheckCircle className="w-4 h-4 inline mr-1 text-green-500" />
            {Object.values(integrations.channels).filter(c => c.enabled).length} canales activos
          </div>
          
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Guardar Integraciones
          </button>
        </div>
      </div>
    </div>
  );
});

IntegrationSettings.displayName = 'IntegrationSettings';

export default IntegrationSettings;

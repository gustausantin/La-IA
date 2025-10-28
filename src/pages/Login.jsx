import { useState, useEffect } from "react";
import { useAuthContext } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import {
  Bot,
  MessageCircle,
  Zap,
  CheckCircle2,
  Star,
  Shield,
  TrendingUp,
  Heart,
  Sparkles,
} from "lucide-react";

// Componente de feature card REDISEÑADO - Layout horizontal optimizado
const FeatureCard = ({ icon, title, description }) => (
  <div className="group relative overflow-hidden bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl p-2 hover:bg-white/15 transition-all duration-300 hover:scale-105 hover:shadow-2xl">
    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    <div className="relative z-10 flex items-start gap-2">
      <div className="w-9 h-9 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <div className="flex-1">
        <h4 className="font-bold text-white text-sm mb-0.5">{title}</h4>
        <p className="text-white/90 text-xs leading-relaxed font-medium">{description}</p>
      </div>
    </div>
  </div>
);

// Componente de testimonial REDISEÑADO
const TestimonialCard = ({ quote, author, business, savings }) => (
  <div className="relative overflow-hidden bg-white/15 backdrop-blur-xl border border-white/30 rounded-xl p-2 hover:bg-white/20 transition-all duration-300 group">
    <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    <div className="relative z-10">
      <div className="flex gap-0.5 mb-2">
      {[...Array(5)].map((_, i) => (
          <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400 animate-pulse" style={{animationDelay: `${i * 0.1}s`}} />
      ))}
    </div>
      <p className="text-white/95 text-xs italic mb-2 font-medium leading-relaxed">"{quote}"</p>
    <div className="flex items-center justify-between">
      <div>
          <p className="font-bold text-white text-xs">{author}</p>
          <p className="text-white/70 text-xs">{business}</p>
      </div>
      {savings && (
          <div className="text-right bg-green-500/20 backdrop-blur rounded-lg px-2 py-0.5">
            <p className="text-white/70 text-xs">Ahorro mensual</p>
            <p className="font-bold text-green-300 text-xs">€{savings}</p>
        </div>
      )}
      </div>
    </div>
  </div>
);

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showResendButton, setShowResendButton] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  // Estados simplificados para login y registro
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const { login } = useAuthContext();

  const handleResendConfirmation = async () => {
    setResendLoading(true);
    setError("");
    setMessage("");

    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/confirm`,
        }
      });

      if (resendError) {
        throw resendError;
      }

      setMessage(`✅ ¡Email de confirmación reenviado!
      
📧 Hemos enviado un nuevo email de confirmación a: ${email}

🔗 Por favor, revisa tu bandeja de entrada (y spam) y haz clic en el enlace para activar tu cuenta.`);
      
    } catch (err) {
      if (err.message.includes('rate_limit') || err.message.includes('over_email_send_rate_limit')) {
        setError("Has alcanzado el límite de emails por hora. Inténtalo más tarde.");
      } else {
        setError(`Error al reenviar email: ${err.message}`);
      }
    } finally {
      setResendLoading(false);
    }
  };

  // ❌ DESHABILITADO: No forzar logout automático
  // useEffect(() => {
  //   const forceLogout = async () => {
  //     await supabase.auth.signOut();
  //     localStorage.clear();
  //     sessionStorage.clear();
  //   };
  //   forceLogout();
  // }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const result = await login(email, password);

      if (!result.success) {
        if (result.error?.includes("Email not confirmed")) {
          setError("Por favor confirma tu email antes de hacer login. Revisa tu bandeja de entrada.");
          setShowResendButton(true);
        } else if (result.error?.includes("Invalid login credentials")) {
          setError("Email o contraseña incorrectos.");
          setShowResendButton(false);
        } else {
          setError(result.error || "Error al iniciar sesión");
          setShowResendButton(false);
        }
      }
    } catch (err) {
      setError("Error inesperado. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    // Validaciones básicas
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      setLoading(false);
      return;
    }

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          emailRedirectTo: `${window.location.origin}/confirm`,
          data: {
            email_confirm: false // ✅ No requiere confirmación
          }
        },
      });

      if (authError) {
        throw authError;
      }

      if (authData.user) {
        // ✅ REGISTRO EXITOSO - Login automático
        setMessage(`✅ ¡Cuenta creada exitosamente! Redirigiendo...`);
        
        // Auto-login después de registro
        setTimeout(async () => {
          const result = await login(email, password);
          if (!result.success) {
            setError("Cuenta creada pero error al iniciar sesión. Intenta hacer login manualmente.");
          }
        }, 1500);
        
        setLoading(false);
        return;
      }
    } catch (err) {
      if (err.message.includes("already registered")) {
        setError("Este email ya está registrado. Intenta hacer login.");
      } else {
        setError(err.message || "Error al crear la cuenta. Inténtalo de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Componente principal de beneficios - COMPLETAMENTE REDISEÑADO
  const AgentBenefits = () => (
    <div className="lg:block hidden relative">
      <div className="relative overflow-hidden bg-gradient-to-br from-purple-600 via-purple-700 to-blue-600 p-2 rounded-2xl text-white h-full min-h-screen">
        {/* Elementos decorativos de fondo */}
        <div className="absolute inset-0 opacity-30">
          <div className="w-full h-full bg-white/5" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Ccircle cx='30' cy='30' r='4'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }} />
        </div>
        <div className="absolute top-20 right-20 w-32 h-32 bg-white/10 rounded-full blur-xl" />
        <div className="absolute bottom-20 left-20 w-24 h-24 bg-blue-300/20 rounded-full blur-lg" />
        
        <div className="relative z-10">
          {/* Header mejorado */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-xl rounded-2xl flex items-center justify-center">
                <Bot className="w-8 h-8 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-400 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              </div>
            </div>
          <div>
              <h2 className="text-base font-black bg-gradient-to-r from-white to-purple-100 bg-clip-text text-transparent">
                Tu Agente IA 24/7
              </h2>
              <p className="text-white/90 font-semibold text-sm">Recepcionista virtual inteligente</p>
            </div>
        </div>

          {/* Features grid rediseñado */}
          <div className="grid grid-cols-1 gap-2 mb-6">
          <FeatureCard
              icon={<MessageCircle className="w-6 h-6 text-white" />}
            title="Multi-Canal"
            description="WhatsApp, llamadas, Instagram, web. Un agente, todos los canales."
          />
          <FeatureCard
              icon={<Zap className="w-6 h-6 text-white" />}
            title="Respuesta Instantánea"
            description="0 segundos de espera. Tu agente responde al instante, siempre."
          />
          <FeatureCard
              icon={<TrendingUp className="w-6 h-6 text-white" />}
            title="Más Citas"
            description="Aumenta tus citas un 35% capturando clientes 24/7."
          />
          <FeatureCard
              icon={<Shield className="w-6 h-6 text-white" />}
            title="Sin Errores"
            description="Olvídate de citas duplicadas o errores de comunicación."
          />
        </div>

          {/* Testimonials rediseñados */}
          <div className="space-y-3 mb-6">
            <h3 className="font-black text-base mb-4 flex items-center gap-2">
              <Heart className="w-5 h-5 text-pink-300 fill-pink-300" />
            Lo que dicen nuestros clientes
          </h3>
          <TestimonialCard
            quote="En 2 meses hemos aumentado las citas un 40%. El agente nunca duerme."
            author="Carlos Mendoza"
            business="Fisioterapia Mendoza"
            savings="1,200"
          />
          <TestimonialCard
            quote="Ya no pierdo citas por no contestar el WhatsApp. ¡Es increíble!"
            author="María García"
            business="Centro Estética Glow"
            savings="800"
          />
        </div>

          {/* Oferta especial rediseñada */}
          <div className="relative overflow-hidden bg-gradient-to-r from-yellow-400/20 to-orange-400/20 backdrop-blur-xl border border-yellow-300/30 rounded-2xl p-2">
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-300/10 to-transparent" />
            <div className="relative z-10 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Sparkles className="w-6 h-6 text-yellow-300" />
                <p className="text-yellow-100 font-bold text-sm">🎁 Oferta especial</p>
              </div>
              <p className="text-lg font-black text-white mb-1">14 días GRATIS</p>
              <p className="text-white/90 font-semibold">Sin tarjeta de crédito</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50/30 to-blue-50/30 flex relative overflow-hidden">
      {/* Elementos decorativos de fondo */}
      <div className="absolute inset-0 opacity-40" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23a855f7' fill-opacity='0.03'%3E%3Ccircle cx='20' cy='20' r='2'/%3E%3C/g%3E%3C/svg%3E")`
      }} />
      
      {/* Panel izquierdo - Formularios REDISEÑADO */}
      <div className="flex-1 flex items-center justify-center p-2 relative z-10">
        <div className="max-w-md w-full space-y-8">
          {/* Header principal rediseñado */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center shadow-2xl">
                  <Bot className="w-8 h-8 text-white" />
                </div>
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-400 rounded-full flex items-center justify-center shadow-lg">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                </div>
              </div>
              <div className="text-left">
                <h1 className="text-lg font-black bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  La-IA
                </h1>
                <p className="text-gray-600 text-sm font-semibold">Powered by AI</p>
              </div>
            </div>
            <p className="text-gray-700 text-base font-bold mb-2">
              Sistema Inteligente de Gestión
            </p>
            <p className="text-gray-500 text-sm font-medium">
              Automatiza tu negocio con IA avanzada
            </p>
          </div>

          {/* Contenedor principal del formulario */}
          <div className="relative overflow-hidden bg-white/80 backdrop-blur-xl border border-white/50 rounded-2xl shadow-2xl p-2">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-50/50 to-blue-50/30" />
            <div className="relative z-10">
              
              {/* Toggle Login/Registro REDISEÑADO */}
              <div className="flex mb-8 bg-gradient-to-r from-purple-100 to-blue-100 rounded-2xl p-1.5 shadow-inner">
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(true);
                    setError("");
                    setMessage("");
                  }}
                  className={`flex-1 py-3 px-6 rounded-xl text-sm font-bold transition-all duration-300 ${
                    isLogin
                      ? "bg-white text-purple-600 shadow-lg transform scale-105"
                      : "text-purple-500 hover:text-purple-700"
                  }`}
                >
                  Iniciar Sesión
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(false);
                    setError("");
                    setMessage("");
                  }}
                  className={`flex-1 py-3 px-6 rounded-xl text-sm font-bold transition-all duration-300 ${
                    !isLogin
                      ? "bg-white text-purple-600 shadow-lg transform scale-105"
                      : "text-purple-500 hover:text-purple-700"
                  }`}
                >
                  Crear Cuenta
                </button>
              </div>

              {/* Mensajes rediseñados */}
            {error && (
                <div className="mb-6 p-2 bg-red-50 border-l-4 border-red-400 rounded-xl">
                  <p className="text-red-700 text-sm font-semibold">{error}</p>
                  {showResendButton && (
                    <button
                      onClick={handleResendConfirmation}
                      disabled={resendLoading}
                      className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold rounded-lg transition-colors duration-200 flex items-center gap-2"
                    >
                      {resendLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Enviando...
                        </>
                      ) : (
                        <>
                          📧 Reenviar Email de Confirmación
                        </>
                      )}
                    </button>
                  )}
              </div>
            )}

            {message && (
                <div className="mb-6 p-2 bg-green-50 border-l-4 border-green-400 rounded-xl">
                  <p className="text-green-700 text-sm font-semibold whitespace-pre-line">{message}</p>
                  {showResendButton && (
                    <button
                      onClick={handleResendConfirmation}
                      disabled={resendLoading}
                      className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold rounded-lg transition-colors duration-200 flex items-center gap-2"
                    >
                      {resendLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Enviando...
                        </>
                      ) : (
                        <>
                          📧 Reenviar Email de Confirmación
                        </>
                      )}
                    </button>
                  )}
              </div>
            )}

              {/* Formulario de Login REDISEÑADO */}
            {isLogin ? (
                <form onSubmit={handleLogin} className="space-y-6">
                <div>
                    <label htmlFor="email" className="block text-sm font-bold text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-purple-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 transition-all duration-300 font-medium bg-white/50 backdrop-blur"
                    placeholder="tu@email.com"
                  />
                </div>

                <div>
                    <label htmlFor="password" className="block text-sm font-bold text-gray-700 mb-2">
                    Contraseña
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-purple-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 transition-all duration-300 font-medium bg-white/50 backdrop-blur"
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-4 px-6 rounded-xl hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-4 focus:ring-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 font-bold text-sm shadow-xl hover:shadow-2xl transform hover:scale-105"
                >
                  {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
                </button>

                <div className="text-center">
                    <a href="#" className="text-sm text-purple-600 hover:text-purple-700 font-semibold">
                    ¿Olvidaste tu contraseña?
                  </a>
                </div>
              </form>
            ) : (
                /* Formulario de Registro SIMPLIFICADO */
                <form onSubmit={handleRegister} className="space-y-6">
                  <div className="mb-4 text-center">
                    <p className="text-gray-600 font-semibold text-sm">
                      Crea tu cuenta en 30 segundos
                    </p>
                  </div>

                  <div>
                    <label htmlFor="reg-email" className="block text-sm font-bold text-gray-700 mb-2">
                      Email *
                    </label>
                    <input
                      id="reg-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-purple-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 transition-all duration-300 font-medium bg-white/50 backdrop-blur"
                      placeholder="tu@email.com"
                    />
                  </div>

                  <div>
                    <label htmlFor="reg-password" className="block text-sm font-bold text-gray-700 mb-2">
                      Contraseña *
                    </label>
                    <input
                      id="reg-password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-purple-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 transition-all duration-300 font-medium bg-white/50 backdrop-blur"
                      placeholder="Mínimo 6 caracteres"
                    />
                  </div>

                  <div>
                    <label htmlFor="confirm-password" className="block text-sm font-bold text-gray-700 mb-2">
                      Confirmar Contraseña *
                    </label>
                    <input
                      id="confirm-password"
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-purple-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 transition-all duration-300 font-medium bg-white/50 backdrop-blur"
                      placeholder="Repite la contraseña"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-4 px-6 rounded-xl hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-4 focus:ring-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 font-bold text-sm shadow-xl hover:shadow-2xl transform hover:scale-105 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Creando cuenta...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        Crear Cuenta Gratis
                      </>
                    )}
                  </button>

                  <div className="mt-4 p-3 bg-gradient-to-r from-purple-100 to-blue-100 rounded-xl border border-purple-200">
                    <p className="text-sm text-purple-700 text-center font-bold">
                      💡 Después del registro, podrás configurar tu negocio completo
                    </p>
                  </div>
                </form>
            )}
          </div>
          </div>

          {/* Info adicional rediseñada */}
          {isLogin && (
            <div className="text-center space-y-4">
              <p className="text-gray-600 font-medium">
                ¿No tienes cuenta?
                <button
                  onClick={() => {
                    setIsLogin(false);
                    setError("");
                    setMessage("");
                  }}
                  className="text-purple-600 hover:text-purple-700 font-bold ml-2 hover:underline"
                >
                  Prueba 14 días gratis
                </button>
              </p>
              <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="font-semibold">Sin tarjeta</span>
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="font-semibold">Setup en 2 min</span>
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="font-semibold">Cancela cuando quieras</span>
                </span>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="text-center text-sm text-gray-500 font-medium">
            <p>© 2024 La-IA. Sistema Inteligente de Gestión para Profesionales</p>
          </div>
        </div>
      </div>

      {/* Panel derecho - Beneficios (solo desktop) */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-2/5">
        <AgentBenefits />
      </div>
    </div>
  );
}


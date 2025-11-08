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

// Componente de feature card MOBILE-FIRST OPTIMIZADO
const FeatureCard = ({ icon, title, description }) => (
  <div className="group relative overflow-hidden bg-white/10 backdrop-blur-xl border border-white/20 rounded-lg sm:rounded-xl p-2 sm:p-3 hover:bg-white/15 transition-all duration-300 hover:scale-105 hover:shadow-2xl">
    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    <div className="relative z-10 flex items-start gap-2">
      <div className="w-8 h-8 sm:w-9 sm:h-9 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-white text-xs sm:text-sm mb-0.5 line-clamp-1">{title}</h4>
        <p className="text-white/90 text-[10px] sm:text-xs leading-relaxed font-medium line-clamp-2">{description}</p>
      </div>
    </div>
  </div>
);

// Componente de testimonial MOBILE-FIRST OPTIMIZADO
const TestimonialCard = ({ quote, author, business, savings }) => (
  <div className="relative overflow-hidden bg-white/15 backdrop-blur-xl border border-white/30 rounded-lg sm:rounded-xl p-2 sm:p-3 hover:bg-white/20 transition-all duration-300 group">
    <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    <div className="relative z-10">
      <div className="flex gap-0.5 mb-1.5 sm:mb-2">
      {[...Array(5)].map((_, i) => (
          <Star key={i} className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-yellow-400 text-yellow-400 animate-pulse" style={{animationDelay: `${i * 0.1}s`}} />
      ))}
    </div>
      <p className="text-white/95 text-[10px] sm:text-xs italic mb-2 font-medium leading-relaxed line-clamp-3">"{quote}"</p>
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0 flex-1">
          <p className="font-bold text-white text-[10px] sm:text-xs truncate">{author}</p>
          <p className="text-white/70 text-[10px] sm:text-xs truncate">{business}</p>
      </div>
      {savings && (
          <div className="text-right bg-green-500/20 backdrop-blur rounded-lg px-1.5 sm:px-2 py-0.5 flex-shrink-0">
            <p className="text-white/70 text-[9px] sm:text-xs whitespace-nowrap">Ahorro mensual</p>
            <p className="font-bold text-green-300 text-[10px] sm:text-xs whitespace-nowrap">€{savings}</p>
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
        setMessage(`✅ ¡Bienvenido! Tu cuenta ha sido creada exitosamente`);
        
        // Auto-login después de registro (SIN mostrar "Bienvenido de vuelta")
        setTimeout(async () => {
          const result = await login(email, password, { skipWelcomeMessage: true });
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
      <div className="relative overflow-hidden bg-gradient-to-br from-purple-600 via-purple-700 to-blue-600 p-3 rounded-xl text-white h-full min-h-screen">
        {/* Elementos decorativos de fondo */}
        <div className="absolute inset-0 opacity-20">
          <div className="w-full h-full bg-white/5" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Ccircle cx='30' cy='30' r='4'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }} />
        </div>
        <div className="absolute top-10 right-10 w-20 h-20 bg-white/10 rounded-full blur-xl" />
        <div className="absolute bottom-10 left-10 w-16 h-16 bg-blue-300/20 rounded-full blur-lg" />
        
        <div className="relative z-10 space-y-3">
          {/* Header mejorado */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-xl rounded-xl flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-green-400 rounded-full flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              </div>
            </div>
          <div>
              <h2 className="text-sm font-black bg-gradient-to-r from-white to-purple-100 bg-clip-text text-transparent">
                Tu Agente IA 24/7
              </h2>
              <p className="text-white/90 font-semibold text-xs">Recepcionista virtual inteligente</p>
            </div>
        </div>

          {/* Features grid rediseñado */}
          <div className="grid grid-cols-1 gap-1.5">
          <FeatureCard
              icon={<MessageCircle className="w-5 h-5 text-white" />}
            title="Multi-Canal"
            description="WhatsApp, llamadas, Instagram, web. Un agente, todos los canales."
          />
          <FeatureCard
              icon={<Zap className="w-5 h-5 text-white" />}
            title="Respuesta Instantánea"
            description="0 segundos de espera. Tu agente responde al instante, siempre."
          />
          <FeatureCard
              icon={<TrendingUp className="w-5 h-5 text-white" />}
            title="Más Citas"
            description="Aumenta tus citas un 35% capturando clientes 24/7."
          />
          <FeatureCard
              icon={<Shield className="w-5 h-5 text-white" />}
            title="Sin Errores"
            description="Olvídate de citas duplicadas o errores de comunicación."
          />
        </div>

          {/* Testimonials rediseñados */}
          <div className="space-y-2">
            <h3 className="font-black text-sm flex items-center gap-1.5">
              <Heart className="w-4 h-4 text-pink-300 fill-pink-300" />
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
          <div className="relative overflow-hidden bg-gradient-to-r from-yellow-400/20 to-orange-400/20 backdrop-blur-xl border border-yellow-300/30 rounded-xl p-3">
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-300/10 to-transparent" />
            <div className="relative z-10 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1.5">
                <Sparkles className="w-5 h-5 text-yellow-300" />
                <p className="text-yellow-100 font-bold text-xs">🎁 Oferta especial</p>
              </div>
              <p className="text-base font-black text-white mb-1">14 días GRATIS</p>
              <p className="text-white/90 font-semibold text-xs">Sin tarjeta de crédito</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50/30 to-blue-50/30 flex flex-col lg:flex-row relative overflow-hidden">
      {/* Elementos decorativos de fondo */}
      <div className="absolute inset-0 opacity-40" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23a855f7' fill-opacity='0.03'%3E%3Ccircle cx='20' cy='20' r='2'/%3E%3C/g%3E%3C/svg%3E")`
      }} />
      
      {/* Panel izquierdo - Formularios GLASSMORPHISM */}
      <div className="flex-1 flex items-center justify-center p-3 sm:p-4 lg:p-6 relative z-10">
        <div className="max-w-md w-full">
          {/* Header con glass effect - MOBILE-FIRST */}
          <div className="text-center mb-4 sm:mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-purple-600 via-purple-500 to-blue-600 rounded-2xl sm:rounded-3xl shadow-2xl mb-3 sm:mb-4 relative">
              <Bot className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
              <div className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 w-4 h-4 sm:w-5 sm:h-5 bg-green-400 rounded-full border-2 border-white shadow-lg">
                <div className="w-full h-full rounded-full bg-green-500 animate-ping opacity-75"></div>
              </div>
            </div>
            <h1 className="text-xl sm:text-2xl font-black bg-gradient-to-r from-purple-600 via-blue-600 to-purple-600 bg-clip-text text-transparent mb-1 sm:mb-2">La-IA</h1>
            <p className="text-xs sm:text-sm text-gray-600 font-medium">Sistema Inteligente de Gestión</p>
          </div>

          {/* Contenedor formulario GLASS - MOBILE-FIRST */}
          <div className="relative backdrop-blur-xl bg-white/90 rounded-2xl sm:rounded-3xl shadow-2xl border border-white/50 overflow-hidden">
            {/* Efecto brillo */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-50/50 via-transparent to-blue-50/50"></div>
            
            {/* Toggle Login/Registro MOBILE-FIRST */}
            <div className="relative grid grid-cols-2 p-1.5 sm:p-2 bg-gray-50/50">
              <button
                type="button"
                onClick={() => {
                  setIsLogin(true);
                  setError("");
                  setMessage("");
                }}
                className={`relative py-2.5 sm:py-3 text-xs sm:text-sm font-bold rounded-lg sm:rounded-xl transition-all duration-300 ${
                  isLogin
                    ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-500/30"
                    : "text-gray-600 hover:text-gray-900 hover:bg-white/50"
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
                className={`relative py-2.5 sm:py-3 text-xs sm:text-sm font-bold rounded-lg sm:rounded-xl transition-all duration-300 ${
                  !isLogin
                    ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-500/30"
                    : "text-gray-600 hover:text-gray-900 hover:bg-white/50"
                }`}
              >
                Crear Cuenta
              </button>
            </div>

            {/* Contenido del formulario - MOBILE-FIRST */}
            <div className="relative p-4 sm:p-6">

              {/* Mensajes - MOBILE-FIRST */}
            {error && (
                <div className="mb-3 sm:mb-4 p-2.5 sm:p-3 bg-red-50 border-l-4 border-red-500 rounded-lg">
                  <p className="text-red-700 text-xs sm:text-sm font-medium">{error}</p>
                  {showResendButton && (
                    <button
                      onClick={handleResendConfirmation}
                      disabled={resendLoading}
                      className="mt-2 px-3 py-2 sm:py-1.5 min-h-[44px] sm:min-h-0 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-semibold rounded-lg transition-colors duration-200 flex items-center justify-center gap-1.5 w-full sm:w-auto"
                    >
                      {resendLoading ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Enviando...
                        </>
                      ) : (
                        <>
                          📧 Reenviar Email
                        </>
                      )}
                    </button>
                  )}
              </div>
            )}

            {message && (
                <div className="mb-3 sm:mb-4 p-2.5 sm:p-3 bg-green-50 border-l-4 border-green-500 rounded-lg">
                  <p className="text-green-700 text-xs sm:text-sm font-medium whitespace-pre-line">{message}</p>
                  {showResendButton && (
                    <button
                      onClick={handleResendConfirmation}
                      disabled={resendLoading}
                      className="mt-2 px-3 py-2 sm:py-1.5 min-h-[44px] sm:min-h-0 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-semibold rounded-lg transition-colors duration-200 flex items-center justify-center gap-1.5 w-full sm:w-auto"
                    >
                      {resendLoading ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Enviando...
                        </>
                      ) : (
                        <>
                          📧 Reenviar Email
                        </>
                      )}
                    </button>
                  )}
              </div>
            )}

              {/* Formulario de Login MOBILE-FIRST */}
            {isLogin ? (
                <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5">
                <div>
                    <label htmlFor="email" className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 sm:px-4 py-3 sm:py-3.5 bg-white/80 backdrop-blur border border-purple-200 rounded-xl sm:rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:bg-white transition-all text-sm shadow-sm"
                    placeholder="tu@email.com"
                  />
                </div>

                <div>
                    <label htmlFor="password" className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                    Contraseña
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 sm:px-4 py-3 sm:py-3.5 bg-white/80 backdrop-blur border border-purple-200 rounded-xl sm:rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:bg-white transition-all text-sm shadow-sm"
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                    className="w-full bg-gradient-to-r from-purple-600 via-purple-500 to-blue-600 text-white py-3 sm:py-4 rounded-xl sm:rounded-2xl hover:shadow-2xl hover:shadow-purple-500/50 focus:outline-none focus:ring-4 focus:ring-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold text-sm shadow-xl hover:-translate-y-0.5 min-h-[48px]"
                >
                  {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
                </button>

                <div className="text-center pt-1 sm:pt-2">
                    <a href="#" className="text-xs sm:text-sm text-purple-600 hover:text-purple-700 font-semibold hover:underline">
                    ¿Olvidaste tu contraseña?
                  </a>
                </div>
              </form>
            ) : (
                /* Formulario de Registro GLASSMORPHISM */
                <form onSubmit={handleRegister} className="space-y-5">
                  <div>
                    <label htmlFor="reg-email" className="block text-sm font-semibold text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      id="reg-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3.5 bg-white/80 backdrop-blur border border-purple-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:bg-white transition-all text-sm shadow-sm"
                      placeholder="tu@email.com"
                    />
                  </div>

                  <div>
                    <label htmlFor="reg-password" className="block text-sm font-semibold text-gray-700 mb-2">
                      Contraseña
                    </label>
                    <input
                      id="reg-password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3.5 bg-white/80 backdrop-blur border border-purple-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:bg-white transition-all text-sm shadow-sm"
                      placeholder="Mínimo 6 caracteres"
                    />
                  </div>

                  <div>
                    <label htmlFor="confirm-password" className="block text-sm font-semibold text-gray-700 mb-2">
                      Confirmar Contraseña
                    </label>
                    <input
                      id="confirm-password"
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-3.5 bg-white/80 backdrop-blur border border-purple-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:bg-white transition-all text-sm shadow-sm"
                      placeholder="Repite la contraseña"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-purple-600 via-purple-500 to-blue-600 text-white py-4 rounded-2xl hover:shadow-2xl hover:shadow-purple-500/50 focus:outline-none focus:ring-4 focus:ring-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold text-sm shadow-xl hover:-translate-y-0.5 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Creando cuenta...
                      </>
                    ) : (
                      "Crear Cuenta Gratis"
                    )}
                  </button>
                </form>
            )}
            </div>
          </div>

          {/* Info adicional LIMPIA */}
          <div className="text-center mt-6">
            <p className="text-sm text-gray-600">
              {isLogin ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError("");
                  setMessage("");
                }}
                className="text-purple-600 hover:text-purple-700 font-semibold ml-2"
              >
                {isLogin ? "Prueba 14 días gratis" : "Inicia sesión"}
              </button>
            </p>
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-gray-400 mt-8">
            <p>© 2024 La-IA. Sistema Inteligente de Gestión</p>
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


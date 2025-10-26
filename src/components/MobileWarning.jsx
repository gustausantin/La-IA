// Componente para avisar en móviles pequeños
import { Smartphone, Monitor, Tablet } from 'lucide-react';

export default function MobileWarning() {
    return (
        <div className="fixed inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-purple-700 z-50 flex items-center justify-center p-6 sm:hidden">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm text-center">
                <div className="mb-6">
                    <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Tablet className="w-10 h-10 text-purple-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        Dispositivo no óptimo
                    </h2>
                    <p className="text-gray-600 text-sm leading-relaxed">
                        Para la mejor experiencia, por favor utiliza:
                    </p>
                </div>

                <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
                        <Monitor className="w-6 h-6 text-blue-600 flex-shrink-0" />
                        <span className="text-sm text-gray-700 font-medium">Ordenador</span>
                    </div>
                    <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
                        <Tablet className="w-6 h-6 text-purple-600 flex-shrink-0" />
                        <span className="text-sm text-gray-700 font-medium">Tablet (iPad, Android)</span>
                    </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <p className="text-xs text-blue-800 font-medium">
                        💡 Puedes instalar La-IA como app en tu tablet para una experiencia nativa
                    </p>
                </div>

                <p className="text-xs text-gray-500">
                    Esta aplicación está optimizada para pantallas grandes (tablets y ordenadores)
                </p>
            </div>
        </div>
    );
}


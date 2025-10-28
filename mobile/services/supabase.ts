import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// IMPORTANTE: Configura estas variables en tu archivo .env o app.json
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || 'https://zrcsujgurtglyqoqiynr.supabase.co';
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || 'tu-anon-key-aqui';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Helper para crear negocio
export interface CreateBusinessData {
  name: string;
  vertical_type: string;
  email?: string;
  phone?: string;
  city?: string;
  address?: string;
  postal_code?: string;
  settings?: any;
  active?: boolean;
}

export interface CreateBusinessResponse {
  success: boolean;
  business_id?: string;
  business_name?: string;
  message?: string;
  error?: string;
}

export async function createBusiness(
  businessData: CreateBusinessData,
  userProfile?: any
): Promise<CreateBusinessResponse> {
  try {
    const { data, error } = await supabase.rpc('create_business_securely', {
      business_data: businessData,
      user_profile: userProfile || {},
    });

    if (error) {
      console.error('[createBusiness] Error:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return data as CreateBusinessResponse;
  } catch (error: any) {
    console.error('[createBusiness] Exception:', error);
    return {
      success: false,
      error: error.message || 'Error desconocido',
    };
  }
}

// Helper para simular llamada IA
export interface SimulateVoiceCallData {
  business_id: string;
  vertical_type?: string;
  greeting_script?: string;
}

export interface SimulateVoiceCallResponse {
  success: boolean;
  transcript?: string;
  audio_url?: string;
  metadata?: any;
  message?: string;
  error?: string;
}

export async function simulateVoiceCall(
  data: SimulateVoiceCallData
): Promise<SimulateVoiceCallResponse> {
  try {
    const { data: result, error } = await supabase.functions.invoke('voice-simulate', {
      body: data,
    });

    if (error) {
      console.error('[simulateVoiceCall] Error:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return result as SimulateVoiceCallResponse;
  } catch (error: any) {
    console.error('[simulateVoiceCall] Exception:', error);
    return {
      success: false,
      error: error.message || 'Error desconocido',
    };
  }
}

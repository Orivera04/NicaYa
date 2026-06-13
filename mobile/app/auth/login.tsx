import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { authApi } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { Colors } from '../../constants/colors';
import { Button } from '../../components/Button';
import type { AuthUser } from '../../hooks/useAuth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }
    setLoading(true);
    try {
      const { data } = await authApi.login(email.trim().toLowerCase(), password);
      const { user, accessToken, refreshToken } = data.data;
      await login(accessToken, refreshToken, user as AuthUser);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      Alert.alert('Error', axiosErr.response?.data?.error ?? 'Credenciales inválidas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Ionicons name="bicycle" size={40} color={Colors.white} />
          </View>
          <Text style={styles.logoText}>MotoYa</Text>
          <Text style={styles.logoSubtitle}>Tu moto, tu camino</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.title}>Iniciar sesión</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Correo electrónico</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor={Colors.textMuted}
              placeholder="tu@correo.com"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Contraseña</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, { flex: 1, borderWidth: 0, marginBottom: 0 }]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                placeholderTextColor={Colors.textMuted}
                placeholder="••••••••"
              />
              <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
                <Ionicons name={showPass ? 'eye-off' : 'eye'} size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <Button title="Ingresar" onPress={handleLogin} loading={loading} style={styles.loginBtn} />

          <TouchableOpacity onPress={() => router.push('/auth/register')} style={styles.registerLink}>
            <Text style={styles.registerText}>
              ¿No tienes cuenta?{' '}
              <Text style={{ color: Colors.primary, fontWeight: '600' }}>Regístrate</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
  },
  logoContainer: { alignItems: 'center', marginBottom: 48 },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoText: { color: Colors.textPrimary, fontSize: 32, fontWeight: '800' },
  logoSubtitle: { color: Colors.textMuted, fontSize: 14, marginTop: 4 },
  form: {},
  title: { color: Colors.textPrimary, fontSize: 24, fontWeight: '700', marginBottom: 24 },
  inputGroup: { marginBottom: 16 },
  label: { color: Colors.textSecondary, fontSize: 14, fontWeight: '500', marginBottom: 8 },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: Colors.textPrimary,
    fontSize: 16,
    marginBottom: 4,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingRight: 12,
  },
  eyeBtn: { padding: 4 },
  loginBtn: { marginTop: 8, marginBottom: 16 },
  registerLink: { alignItems: 'center', paddingVertical: 12 },
  registerText: { color: Colors.textSecondary, fontSize: 15 },
});

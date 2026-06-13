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

type Role = 'CLIENT' | 'RIDER';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('CLIENT');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Error', 'Nombre, correo y contraseña son requeridos');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setLoading(true);
    try {
      const { data } = await authApi.register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        password,
        role,
      });
      const { user, accessToken, refreshToken } = data.data;
      await login(accessToken, refreshToken, user as AuthUser);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      Alert.alert('Error', axiosErr.response?.data?.error ?? 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>

        <Text style={styles.title}>Crear cuenta</Text>
        <Text style={styles.subtitle}>Únete a MotoYa</Text>

        {/* Role selector */}
        <View style={styles.roleContainer}>
          <TouchableOpacity
            style={[styles.roleBtn, role === 'CLIENT' && styles.roleBtnActive]}
            onPress={() => setRole('CLIENT')}
          >
            <Ionicons name="person" size={22} color={role === 'CLIENT' ? Colors.primary : Colors.textSecondary} />
            <Text style={[styles.roleLabel, role === 'CLIENT' && { color: Colors.primary }]}>
              Soy cliente
            </Text>
            <Text style={styles.roleDesc}>Quiero solicitar viajes</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.roleBtn, role === 'RIDER' && styles.roleBtnActive]}
            onPress={() => setRole('RIDER')}
          >
            <Ionicons name="bicycle" size={22} color={role === 'RIDER' ? Colors.primary : Colors.textSecondary} />
            <Text style={[styles.roleLabel, role === 'RIDER' && { color: Colors.primary }]}>
              Soy motorista
            </Text>
            <Text style={styles.roleDesc}>Quiero dar viajes</Text>
          </TouchableOpacity>
        </View>

        {/* Fields */}
        {[
          { label: 'Nombre completo', value: name, setter: setName, placeholder: 'Juan Pérez', kb: 'default' as const },
          { label: 'Correo electrónico', value: email, setter: setEmail, placeholder: 'tu@correo.com', kb: 'email-address' as const },
          { label: 'Teléfono (opcional)', value: phone, setter: setPhone, placeholder: '+505 8888 8888', kb: 'phone-pad' as const },
        ].map(({ label, value, setter, placeholder, kb }) => (
          <View key={label} style={styles.inputGroup}>
            <Text style={styles.label}>{label}</Text>
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={setter}
              keyboardType={kb}
              autoCapitalize={kb === 'email-address' ? 'none' : 'words'}
              autoCorrect={false}
              placeholder={placeholder}
              placeholderTextColor={Colors.textMuted}
            />
          </View>
        ))}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Mínimo 6 caracteres"
            placeholderTextColor={Colors.textMuted}
          />
        </View>

        <Button title="Crear cuenta" onPress={handleRegister} loading={loading} style={{ marginTop: 8 }} />

        <TouchableOpacity onPress={() => router.back()} style={styles.loginLink}>
          <Text style={styles.loginText}>
            ¿Ya tienes cuenta?{' '}
            <Text style={{ color: Colors.primary, fontWeight: '600' }}>Inicia sesión</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  backBtn: { marginBottom: 24 },
  title: { color: Colors.textPrimary, fontSize: 28, fontWeight: '800', marginBottom: 4 },
  subtitle: { color: Colors.textMuted, fontSize: 16, marginBottom: 28 },
  roleContainer: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  roleBtn: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  roleBtnActive: { borderColor: Colors.primary, backgroundColor: '#064E3B22' },
  roleLabel: { color: Colors.textSecondary, fontWeight: '600', fontSize: 14 },
  roleDesc: { color: Colors.textMuted, fontSize: 11, textAlign: 'center' },
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
  },
  loginLink: { alignItems: 'center', paddingTop: 16 },
  loginText: { color: Colors.textSecondary, fontSize: 15 },
});

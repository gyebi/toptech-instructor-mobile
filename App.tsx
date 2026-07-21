import {
  getAuth,
  onAuthStateChanged,
  signInWithPhoneNumber,
  signOut,
  type ConfirmationResult,
  type User,
} from '@react-native-firebase/auth';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  API_URL,
  type AssignedStudent,
  type InstructorProfile,
  loadInstructorWorkspace,
  MobileApiError,
  resolveInstructor,
} from './src/mobile-api';

const auth = getAuth();

type Screen =
  | 'booting'
  | 'phone'
  | 'otp'
  | 'authorizing'
  | 'dashboard';

function normalizeGhanaPhone(value: string): string | null {
  const compact = value.replace(/[\s()-]/g, '');
  const normalized = /^\d{9}$/.test(compact)
    ? `+233${compact}`
    : compact.startsWith('0')
      ? `+233${compact.slice(1)}`
      : compact.startsWith('233')
        ? `+${compact}`
        : compact;

  return /^\+233\d{9}$/.test(normalized) ? normalized : null;
}

function friendlyAuthError(error: unknown): string {
  if (error instanceof MobileApiError) {
    return error.message;
  }

  const code =
    typeof error === 'object' && error && 'code' in error
      ? String(error.code)
      : '';

  switch (code) {
    case 'auth/invalid-phone-number':
      return 'Enter a valid Ghana phone number.';
    case 'auth/invalid-verification-code':
      return 'That verification code is incorrect. Please try again.';
    case 'auth/session-expired':
      return 'The verification code has expired. Request a new code.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait before trying again.';
    case 'auth/network-request-failed':
      return 'Check your internet connection and try again.';
    default:
      return error instanceof Error
        ? error.message
        : 'Something went wrong. Please try again.';
  }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('booting');
  const [phone, setPhone] = useState('');
  const [submittedPhone, setSubmittedPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmation, setConfirmation] =
    useState<ConfirmationResult | null>(null);
  const [profile, setProfile] = useState<InstructorProfile | null>(null);
  const [students, setStudents] = useState<AssignedStudent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const authorizationInFlight = useRef(false);

  const loadWorkspace = useCallback(async (user: User) => {
    const workspace = await loadInstructorWorkspace(user);
    setProfile(workspace.profile);
    setStudents(workspace.students);
    setScreen('dashboard');
  }, []);

  const authorizeUser = useCallback(
    async (user: User) => {
      if (authorizationInFlight.current) return;
      authorizationInFlight.current = true;
      setScreen('authorizing');
      setError(null);

      try {
        await resolveInstructor(user);
        await loadWorkspace(user);
      } catch (authorizationError) {
        await signOut(auth).catch(() => undefined);
        setConfirmation(null);
        setOtp('');
        setScreen('phone');
        setError(friendlyAuthError(authorizationError));
      } finally {
        authorizationInFlight.current = false;
      }
    },
    [loadWorkspace],
  );

  const restoreExistingSession = useCallback(
    async (user: User) => {
      await authorizeUser(user);
    },
    [authorizeUser],
  );

  useEffect(() => {
    let firstAuthState = true;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (firstAuthState) {
        firstAuthState = false;
        if (user) void restoreExistingSession(user);
        else setScreen('phone');
        return;
      }

      if (user) void authorizeUser(user);
    });

    return unsubscribe;
  }, [authorizeUser, restoreExistingSession]);

  const sendCode = async () => {
    const normalizedPhone = normalizeGhanaPhone(phone);
    if (!normalizedPhone) {
      setError('Enter the 9 digits after +233, for example 24 123 4567.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await signInWithPhoneNumber(auth, normalizedPhone);
      setSubmittedPhone(normalizedPhone);
      setConfirmation(result);
      setOtp('');
      setScreen('otp');
    } catch (sendError) {
      setError(friendlyAuthError(sendError));
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    if (!confirmation || !/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit verification code.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const credential = await confirmation.confirm(otp);
      if (credential.user) await authorizeUser(credential.user);
    } catch (verifyError) {
      if (auth.currentUser) await authorizeUser(auth.currentUser);
      else setError(friendlyAuthError(verifyError));
    } finally {
      setBusy(false);
    }
  };

  const refreshWorkspace = async () => {
    if (!auth.currentUser) return;
    setRefreshing(true);
    try {
      await loadWorkspace(auth.currentUser);
    } catch (refreshError) {
      Alert.alert('Unable to refresh', friendlyAuthError(refreshError));
    } finally {
      setRefreshing(false);
    }
  };

  const logOut = async () => {
    await signOut(auth);
    authorizationInFlight.current = false;
    setProfile(null);
    setStudents([]);
    setConfirmation(null);
    setOtp('');
    setPhone('');
    setError(null);
    setScreen('phone');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      {screen === 'dashboard' && profile ? (
        <Dashboard
          profile={profile}
          students={students}
          refreshing={refreshing}
          onRefresh={refreshWorkspace}
          onLogout={logOut}
        />
      ) : (
        <AuthScreen
          screen={screen}
          phone={phone}
          submittedPhone={submittedPhone}
          otp={otp}
          error={error}
          busy={busy}
          onPhoneChange={setPhone}
          onOtpChange={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))}
          onSendCode={sendCode}
          onVerifyCode={verifyCode}
          onChangeNumber={() => {
            setConfirmation(null);
            setOtp('');
            setError(null);
            setScreen('phone');
          }}
        />
      )}
    </SafeAreaView>
  );
}

type AuthScreenProps = {
  screen: Screen;
  phone: string;
  submittedPhone: string;
  otp: string;
  error: string | null;
  busy: boolean;
  onPhoneChange: (value: string) => void;
  onOtpChange: (value: string) => void;
  onSendCode: () => void;
  onVerifyCode: () => void;
  onChangeNumber: () => void;
};

function AuthScreen(props: AuthScreenProps) {
  const waiting = props.screen === 'booting' || props.screen === 'authorizing';
  const enteringOtp = props.screen === 'otp';

  return (
    <KeyboardAvoidingView
      style={styles.authBackground}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.authContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandPanel}>
          <Image
            source={require('./assets/splash-icon.png')}
            style={styles.brandLogo}
            resizeMode="contain"
          />
          <Text style={styles.brandEyebrow}>INSTRUCTOR APP</Text>
          <Text style={styles.brandTitle}>Welcome back</Text>
          <Text style={styles.brandCopy}>
            Sign in securely to view the students assigned to you.
          </Text>
        </View>

        <View style={styles.authCard}>
          {waiting ? (
            <View style={styles.loadingPanel}>
              <ActivityIndicator size="large" color={colors.brandBlue} />
              <Text style={styles.loadingTitle}>
                {props.screen === 'authorizing'
                  ? 'Checking your staff account…'
                  : 'Preparing your workspace…'}
              </Text>
              <Text style={styles.mutedText}>This should only take a moment.</Text>
            </View>
          ) : enteringOtp ? (
            <>
              <Text style={styles.cardTitle}>Enter verification code</Text>
              <Text style={styles.cardCopy}>
                We sent a 6-digit code to {props.submittedPhone}.
              </Text>
              <Text style={styles.label}>Verification code</Text>
              <TextInput
                value={props.otp}
                onChangeText={props.onOtpChange}
                style={[styles.input, styles.otpInput]}
                placeholder="000000"
                placeholderTextColor="#98A2B3"
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                maxLength={6}
                autoFocus
              />
              {props.error ? <ErrorMessage message={props.error} /> : null}
              <PrimaryButton
                label="Verify and continue"
                busy={props.busy}
                disabled={props.otp.length !== 6}
                onPress={props.onVerifyCode}
              />
              <Pressable onPress={props.onChangeNumber} style={styles.textButton}>
                <Text style={styles.textButtonLabel}>Use a different number</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.cardTitle}>Staff login</Text>
              <Text style={styles.cardCopy}>
                Use the phone number registered by your administrator.
              </Text>
              <Text style={styles.label}>Phone number</Text>
              <View style={styles.phoneInputRow}>
                <View style={styles.countryCode}>
                  <Text style={styles.countryCodeText}>GH +233</Text>
                </View>
                <TextInput
                  value={props.phone}
                  onChangeText={props.onPhoneChange}
                  style={styles.phoneInput}
                  placeholder="24 123 4567"
                  placeholderTextColor="#98A2B3"
                  keyboardType="phone-pad"
                  textContentType="telephoneNumber"
                  autoComplete="tel"
                  autoFocus
                />
              </View>
              {props.error ? <ErrorMessage message={props.error} /> : null}
              <PrimaryButton
                label="Send verification code"
                busy={props.busy}
                onPress={props.onSendCode}
              />
              <Text style={styles.consentText}>
                By continuing, you agree to receive an SMS verification code.
                Your phone number is processed by Firebase for security and abuse
                prevention.
              </Text>
            </>
          )}
        </View>

        <Text style={styles.environmentText}>Secure connection · {API_URL}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

function PrimaryButton({
  label,
  busy,
  disabled,
  onPress,
}: {
  label: string;
  busy?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy || disabled}
      style={({ pressed }) => [
        styles.primaryButton,
        pressed && styles.primaryButtonPressed,
        (busy || disabled) && styles.primaryButtonDisabled,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={colors.white} />
      ) : (
        <Text style={styles.primaryButtonText}>{label}</Text>
      )}
    </Pressable>
  );
}

function Dashboard({
  profile,
  students,
  refreshing,
  onRefresh,
  onLogout,
}: {
  profile: InstructorProfile;
  students: AssignedStudent[];
  refreshing: boolean;
  onRefresh: () => void;
  onLogout: () => void;
}) {
  return (
    <View style={styles.dashboard}>
      <View style={styles.dashboardHeader}>
        <View style={styles.headerIdentity}>
          <Text style={styles.headerEyebrow}>GOOD DAY</Text>
          <Text style={styles.headerName}>{profile.firstName}</Text>
          <Text style={styles.headerMeta}>
            {profile.employeeNumber} · {profile.branch?.name ?? 'No branch'}
          </Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {profile.firstName.charAt(0)}{profile.lastName.charAt(0)}
          </Text>
        </View>
      </View>

      <FlatList
        data={students}
        keyExtractor={(item) => item.assignmentId}
        contentContainerStyle={styles.studentList}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.brandBlue]}
          />
        }
        ListHeaderComponent={
          <>
            <View style={styles.summaryCard}>
              <View>
                <Text style={styles.summaryLabel}>ASSIGNED STUDENTS</Text>
                <Text style={styles.summaryNumber}>{students.length}</Text>
              </View>
              <View style={styles.typePill}>
                <Text style={styles.typePillText}>{profile.instructorType}</Text>
              </View>
            </View>
            <View style={styles.sectionHeadingRow}>
              <View>
                <Text style={styles.sectionTitle}>My students</Text>
                <Text style={styles.sectionCopy}>
                  Active assignments only
                </Text>
              </View>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No students assigned yet</Text>
            <Text style={styles.emptyCopy}>
              New active assignments will appear here automatically.
            </Text>
          </View>
        }
        renderItem={({ item }) => <StudentCard assignment={item} />}
        ListFooterComponent={
          <View style={styles.settingsCard}>
            <Text style={styles.settingsTitle}>Account</Text>
            <Text style={styles.settingsCopy}>
              Signed in as {profile.firstName} {profile.lastName}.
            </Text>
            <Pressable onPress={onLogout} style={styles.logoutButton}>
              <Text style={styles.logoutButtonText}>Log out</Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
}

function StudentCard({ assignment }: { assignment: AssignedStudent }) {
  const student = assignment.student;
  return (
    <View style={styles.studentCard}>
      <View style={styles.studentAvatar}>
        <Text style={styles.studentAvatarText}>
          {student.firstName.charAt(0)}{student.lastName.charAt(0)}
        </Text>
      </View>
      <View style={styles.studentDetails}>
        <Text style={styles.studentName}>
          {student.firstName} {student.lastName}
        </Text>
        <Text style={styles.studentNumber}>{student.studentNumber}</Text>
        <Text style={styles.studentCourse} numberOfLines={1}>
          {assignment.course.name}
          {assignment.cohort ? ` · ${assignment.cohort.name}` : ''}
        </Text>
      </View>
      <View style={styles.assignmentBadge}>
        <Text style={styles.assignmentBadgeText}>
          {assignment.assignmentType}
        </Text>
      </View>
    </View>
  );
}

const colors = {
  brandBlue: '#0028A7',
  brandBlueDark: '#001B72',
  brandBlueLight: '#EDF2FF',
  brandYellow: '#FDC400',
  ink: '#172033',
  muted: '#667085',
  line: '#E5E9F0',
  background: '#F5F7FA',
  white: '#FFFFFF',
  error: '#B42318',
  errorBackground: '#FFF0EE',
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  authBackground: { flex: 1, backgroundColor: colors.background },
  authContent: { flexGrow: 1, padding: 20, paddingTop: 32, paddingBottom: 28 },
  brandPanel: { alignItems: 'center', marginBottom: 24 },
  brandLogo: { width: 230, height: 90, marginBottom: 8 },
  brandEyebrow: { color: colors.brandBlue, fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  brandTitle: { color: colors.ink, fontSize: 32, fontWeight: '800', marginTop: 8 },
  brandCopy: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8, maxWidth: 330 },
  authCard: { backgroundColor: colors.white, borderRadius: 24, padding: 22, shadowColor: colors.brandBlue, shadowOpacity: 0.1, shadowRadius: 22, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  cardTitle: { color: colors.ink, fontSize: 22, fontWeight: '800' },
  cardCopy: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 6, marginBottom: 22 },
  label: { color: colors.ink, fontSize: 13, fontWeight: '700', marginBottom: 8 },
  phoneInputRow: { flexDirection: 'row', borderWidth: 1, borderColor: colors.line, borderRadius: 14, overflow: 'hidden', backgroundColor: '#FAFBFC' },
  countryCode: { backgroundColor: colors.brandBlueLight, justifyContent: 'center', paddingHorizontal: 13, borderRightWidth: 1, borderRightColor: colors.line },
  countryCodeText: { color: colors.brandBlueDark, fontSize: 13, fontWeight: '800' },
  phoneInput: { flex: 1, minHeight: 54, color: colors.ink, fontSize: 17, paddingHorizontal: 14 },
  input: { minHeight: 56, borderWidth: 1, borderColor: colors.line, borderRadius: 14, backgroundColor: '#FAFBFC', paddingHorizontal: 15, color: colors.ink, fontSize: 18 },
  otpInput: { letterSpacing: 10, textAlign: 'center', fontSize: 24, fontWeight: '700' },
  primaryButton: { minHeight: 54, borderRadius: 14, backgroundColor: colors.brandBlue, alignItems: 'center', justifyContent: 'center', marginTop: 18, paddingHorizontal: 18 },
  primaryButtonPressed: { backgroundColor: colors.brandBlueDark },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  textButton: { alignItems: 'center', padding: 14, marginTop: 5 },
  textButtonLabel: { color: colors.brandBlue, fontSize: 14, fontWeight: '700' },
  consentText: { color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 18 },
  environmentText: { color: '#98A2B3', fontSize: 10, textAlign: 'center', marginTop: 18 },
  errorBox: { backgroundColor: colors.errorBackground, borderRadius: 12, padding: 12, marginTop: 14 },
  errorText: { color: colors.error, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  loadingPanel: { alignItems: 'center', paddingVertical: 24 },
  loadingTitle: { color: colors.ink, fontSize: 17, fontWeight: '700', marginTop: 18 },
  mutedText: { color: colors.muted, fontSize: 13, marginTop: 6 },
  dashboard: { flex: 1, backgroundColor: colors.background },
  dashboardHeader: { backgroundColor: colors.brandBlueDark, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 28, flexDirection: 'row', alignItems: 'center' },
  headerIdentity: { flex: 1 },
  headerEyebrow: { color: colors.brandYellow, fontSize: 11, fontWeight: '800', letterSpacing: 1.8 },
  headerName: { color: colors.white, fontSize: 28, fontWeight: '800', marginTop: 4 },
  headerMeta: { color: '#D8E1FF', fontSize: 13, marginTop: 5 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.brandYellow, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  studentList: { padding: 16, paddingBottom: 34 },
  summaryCard: { marginTop: -16, backgroundColor: colors.white, borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: colors.brandBlue, shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  summaryLabel: { color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  summaryNumber: { color: colors.ink, fontSize: 36, fontWeight: '900', marginTop: 2 },
  typePill: { backgroundColor: colors.brandBlueLight, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  typePillText: { color: colors.brandBlue, fontSize: 12, fontWeight: '800' },
  sectionHeadingRow: { marginTop: 26, marginBottom: 12 },
  sectionTitle: { color: colors.ink, fontSize: 21, fontWeight: '800' },
  sectionCopy: { color: colors.muted, fontSize: 13, marginTop: 3 },
  studentCard: { backgroundColor: colors.white, borderRadius: 17, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#EEF0F4' },
  studentAvatar: { width: 46, height: 46, borderRadius: 15, backgroundColor: colors.brandBlueLight, alignItems: 'center', justifyContent: 'center' },
  studentAvatarText: { color: colors.brandBlue, fontSize: 14, fontWeight: '900' },
  studentDetails: { flex: 1, marginLeft: 12 },
  studentName: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  studentNumber: { color: colors.brandBlue, fontSize: 11, fontWeight: '700', marginTop: 2 },
  studentCourse: { color: colors.muted, fontSize: 12, marginTop: 4 },
  assignmentBadge: { maxWidth: 88, backgroundColor: '#FFF4CC', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 },
  assignmentBadgeText: { color: '#715600', fontSize: 9, fontWeight: '800', textAlign: 'center' },
  emptyCard: { backgroundColor: colors.white, borderRadius: 17, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: colors.line, borderStyle: 'dashed' },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  emptyCopy: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 6 },
  settingsCard: { backgroundColor: colors.white, borderRadius: 17, padding: 18, marginTop: 20 },
  settingsTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  settingsCopy: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 5 },
  logoutButton: { minHeight: 46, borderRadius: 12, backgroundColor: '#EEF2F6', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  logoutButtonText: { color: colors.error, fontSize: 13, fontWeight: '800' },
});

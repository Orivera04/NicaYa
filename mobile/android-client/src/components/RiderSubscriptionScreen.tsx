import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, BackHandler, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { api } from "../api";
import { theme } from "../theme";

type Plan = { id: string; name: string; description: string; price: string; currency: string; durationDays: number; dailyTripLimit: number; benefits?: string[] };
type Method = { code: "MOTO_EXPRESS" | "BANK_TRANSFER"; name: string; instructions: string; configuration?: Record<string, string> | null };
type Payment = { id: string; externalReference: string; amount: string; currency: string; status: string; method: { code?: string; name: string } };
type Order = { id: string; status: "PENDING_PAYMENT" | "PENDING_REVIEW" | "COMPLETED" | "EXPIRED" | "CANCELLED"; planNameSnapshot: string; priceSnapshot: string; currencySnapshot: string; payments: Payment[] };
type Subscription = { status?: string; expiresAt?: string; plan?: Plan | null } | null;
type CreatedOrder = { order: Order; payment: Payment; method: Method };

const banks = ["BAC Credomatic", "Banpro", "Banco Lafise Bancentro", "Banco Ficohsa", "Banco Avanz", "Banco ProCredit", "Banco de Finanzas", "Otro banco"];
const money = (currency?: string, amount?: string) => `${currency || "NIO"} ${amount || "—"}`;
const date = (value?: string) => value ? new Date(value).toLocaleDateString("es-NI") : "—";
const tone = (name: string) => name.toLowerCase().includes("premium") ? styles.premium : name.toLowerCase().includes("est") ? styles.standard : styles.basic;

function Button({ title, onPress, disabled = false, secondary = false }: { title: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, secondary && styles.secondaryButton, disabled && styles.disabled]}><Text style={[styles.buttonText, secondary && styles.secondaryText]}>{title}</Text></Pressable>;
}

async function selectProof(source: "camera" | "library") {
  const permission = source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error(source === "camera" ? "Permite la cámara para tomar el comprobante." : "Permite la galería para elegir el comprobante.");
  const result = source === "camera"
    ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], base64: true, quality: 0.45, cameraType: ImagePicker.CameraType.back })
    : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], base64: true, quality: 0.45 });
  if (result.canceled || !result.assets[0]?.base64) return null;
  const image = `data:image/jpeg;base64,${result.assets[0].base64}`;
  if (image.length > 490_000) throw new Error("El comprobante es muy grande. Toma una imagen más cercana.");
  return image;
}

export function RiderSubscriptionScreen({ onBack, onMessage }: { onBack: () => void; onMessage: (message: string) => void }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [methods, setMethods] = useState<Method[]>([]);
  const [subscription, setSubscription] = useState<Subscription>(null);
  const [pendingOrder, setPendingOrder] = useState<Order | null>(null);
  const [selected, setSelected] = useState<Plan | null>(null);
  const [method, setMethod] = useState<Method | null>(null);
  const [created, setCreated] = useState<CreatedOrder | null>(null);
  const [bank, setBank] = useState("");
  const [bankPickerOpen, setBankPickerOpen] = useState(false);
  const [transferRef, setTransferRef] = useState("");
  const [proof, setProof] = useState("");
  const [stage, setStage] = useState<"summary" | "plans" | "checkout" | "payment">("summary");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [nextPlans, nextMethods, nextSubscription, orders] = await Promise.all([
      api<Plan[]>("/subscriptions/plans"), api<Method[]>("/subscriptions/methods"), api<Subscription>("/riders/me/subscription"), api<Order[]>("/subscriptions/orders")
    ]);
    setPlans(nextPlans); setMethods(nextMethods); setMethod(current => current || nextMethods[0] || null); setSubscription(nextSubscription); setStage(current => current === "summary" && !nextSubscription ? "plans" : current);
    setPendingOrder(orders.find(order => order.status === "PENDING_PAYMENT" || order.status === "PENDING_REVIEW") || null);
  }, []);
  useEffect(() => { void load().catch(error => onMessage((error as Error).message)); }, [load, onMessage]);

  const active = subscription?.status === "ACTIVE";
  const waiting = Boolean(pendingOrder) && !created;
  const days = subscription?.expiresAt ? Math.max(0, Math.ceil((new Date(subscription.expiresAt).getTime() - Date.now()) / 86_400_000)) : 0;
  const activePlan = useMemo(() => plans.find(plan => plan.id === subscription?.plan?.id || plan.name === subscription?.plan?.name), [plans, subscription]);
  const canChoose = !waiting && !created && stage === "plans";
  const canCheckout = !waiting && !created && stage === "checkout" && Boolean(selected);

  const createOrder = async () => {
    if (!selected || !method) return;
    setBusy(true);
    try { const nextCreated = await api<CreatedOrder>("/subscriptions/orders", { method: "POST", body: JSON.stringify({ planId: selected.id, methodCode: method.code }) }); setPendingOrder(nextCreated.order); setCreated(nextCreated); setStage("payment"); }
    catch (error) { onMessage((error as Error).message); }
    finally { setBusy(false); }
  };
  const resumePayment = () => {
    const payment = pendingOrder?.payments.find(item => item.status === "PENDING_PAYMENT") || pendingOrder?.payments[0];
    if (!pendingOrder || !payment) return onMessage("No encontramos el pago pendiente. Actualiza la pantalla.");
    const resumeMethod = methods.find(item => item.code === payment.method.code || item.name === payment.method.name);
    if (!resumeMethod) return onMessage("El método de pago ya no está disponible. Contacta a administración.");
    setMethod(resumeMethod);
    setSelected(plans.find(plan => plan.name === pendingOrder.planNameSnapshot) || null);
    setCreated({ order: pendingOrder, payment, method: resumeMethod });
    setStage("payment");
  };
  const chooseProof = () => Alert.alert("Adjuntar comprobante", "Elige el origen de la imagen.", [
    { text: "Cancelar", style: "cancel" },
    { text: "Tomar foto", onPress: () => void pick("camera") },
    { text: "Galería", onPress: () => void pick("library") }
  ]);
  const pick = async (source: "camera" | "library") => {
    setBusy(true);
    try { const image = await selectProof(source); if (image) setProof(image); }
    catch (error) { onMessage((error as Error).message); }
    finally { setBusy(false); }
  };
  const sendPayment = async () => {
    if (!created || !bank || !proof || (created.method.code === "BANK_TRANSFER" && !transferRef.trim())) return onMessage("Completa banco de origen, comprobante y referencia cuando corresponda.");
    setBusy(true);
    try {
      if (created.method.code === "MOTO_EXPRESS") await api(`/subscriptions/payments/${created.payment.id}/mark-paid`, { method: "POST", body: JSON.stringify({ bankName: bank, proofReference: proof }) });
      else await api(`/subscriptions/payments/${created.payment.id}/transfer`, { method: "POST", body: JSON.stringify({ bankName: bank, transferReference: transferRef, proofReference: proof }) });
      setCreated(null); setSelected(null); setProof(""); setTransferRef(""); setStage("summary"); await load(); onMessage("Comprobante enviado a validación administrativa.");
    } catch (error) { onMessage((error as Error).message); }
    finally { setBusy(false); }
  };
  const changePlan = useCallback(async () => {
    const order = created?.order || pendingOrder;
    if (!order) { setSelected(null); setStage("plans"); return; }
    setBusy(true);
    try {
      await api(`/subscriptions/orders/${order.id}/cancel`, { method: "POST", body: "{}" });
      setCreated(null); setPendingOrder(null); setSelected(null); setProof(""); setTransferRef(""); setStage("plans");
      onMessage("La referencia anterior fue cancelada. Elige tu nuevo plan.");
    } catch (error) { onMessage((error as Error).message); }
    finally { setBusy(false); }
  }, [created, onMessage, pendingOrder]);
  const receiver = created?.method.configuration || method?.configuration || {};
  const goBack = useCallback(() => {
    if (stage === "payment" || (waiting && pendingOrder?.status === "PENDING_PAYMENT")) { void changePlan(); return; }
    if (stage === "checkout") { setSelected(null); setStage("plans"); return; }
    if (stage === "plans" && active) { setStage("summary"); return; }
    onBack();
  }, [active, changePlan, onBack, pendingOrder?.status, stage, waiting]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { goBack(); return true; });
    return () => subscription.remove();
  }, [goBack]);

  return <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
    <Pressable onPress={goBack} hitSlop={12}><Text style={styles.back}>← {stage === "checkout" ? "Cambiar plan" : stage === "payment" ? "Volver a mi cuenta" : "Volver a mi cuenta"}</Text></Pressable>
    <Text style={styles.eyebrow}>SUSCRIPCIÓN MOTOYA</Text><Text style={styles.title}>{stage === "plans" ? "Elige tu plan mensual" : stage === "checkout" ? "Completa tu pago" : stage === "payment" ? "Envía tu comprobante" : "Mi suscripción"}</Text><Text style={styles.subtitle}>{stage === "plans" ? "Paso 1 de 2 · Selecciona el nivel que necesitas." : stage === "checkout" ? "Paso 2 de 2 · Elige cómo realizarás el pago." : "Elige, paga y consulta el estado de tu plan."}</Text>

    {active && stage === "summary" && !created ? <>
      <View style={styles.activeHero}><Text style={styles.heroLabel}>PLAN ACTIVO</Text><Text style={styles.activeName}>{subscription?.plan?.name || "Plan activo"}</Text><Text style={styles.activeText}>{days} días restantes. Vence {date(subscription?.expiresAt)}.</Text></View>
      <View style={styles.detailCard}><Text style={styles.detailTitle}>Detalle de tu plan</Text><View style={styles.stats}><View style={styles.stat}><Text style={styles.statValue}>{activePlan?.dailyTripLimit || 0}</Text><Text style={styles.statLabel}>viajes por día</Text></View><View style={styles.stat}><Text style={styles.statValue}>{(activePlan?.dailyTripLimit || 0) * (activePlan?.durationDays || 30)}</Text><Text style={styles.statLabel}>máximo mensual</Text></View></View><Text style={styles.detailText}>{activePlan?.description || "Tu plan está activo para recibir solicitudes."}</Text><Button title="Renovar o cambiar plan" onPress={() => setStage("plans")} /></View>
    </> : null}

    {waiting && pendingOrder ? <View style={styles.pendingCard}><Text style={styles.pendingLabel}>{pendingOrder.status === "PENDING_REVIEW" ? "PAGO EN VALIDACIÓN" : "PAGO PENDIENTE"}</Text><Text style={styles.pendingTitle}>{pendingOrder.planNameSnapshot} · {money(pendingOrder.currencySnapshot, pendingOrder.priceSnapshot)}</Text><Text style={styles.pendingText}>{pendingOrder.status === "PENDING_REVIEW" ? "Tu comprobante fue enviado. Administración lo revisará pronto." : "Tu referencia fue creada, pero falta adjuntar y enviar el comprobante."}</Text><Text style={styles.reference}>Ref. MotoYa: {pendingOrder.payments[0]?.externalReference || "—"}</Text>{pendingOrder.status === "PENDING_PAYMENT" ? <><Button title="Completar pago pendiente" onPress={resumePayment} /><Button title="Cambiar plan" secondary disabled={busy} onPress={() => void changePlan()} /></> : null}</View> : null}

    {canChoose ? <><Text style={styles.step}>PASO 1 DE 2</Text><Text style={styles.sectionTitle}>{active ? "Renueva o cambia tu plan" : "Selecciona tu nivel"}</Text>{plans.map(plan => <Pressable key={plan.id} onPress={() => { setSelected(plan); setStage("checkout"); }} style={[styles.planCard, tone(plan.name), selected?.id === plan.id && styles.planSelected]}><View style={styles.planTop}><View><Text style={styles.planName}>{plan.name}</Text><Text style={styles.planDays}>{plan.durationDays} días de vigencia</Text></View><Text style={styles.planPrice}>{money(plan.currency, plan.price)}</Text></View><View style={styles.planStats}><View style={styles.planMetric}><Text style={styles.metricValue}>{plan.dailyTripLimit}</Text><Text style={styles.metricText}>viajes por día</Text></View><View style={styles.planMetric}><Text style={styles.metricValue}>{plan.dailyTripLimit * plan.durationDays}</Text><Text style={styles.metricText}>máximo mensual</Text></View></View><Text style={styles.planDescription}>{plan.description}</Text><Text style={styles.selectLabel}>{selected?.id === plan.id ? "Plan seleccionado" : "Elegir este plan →"}</Text></Pressable>)}
    </> : null}

    {canCheckout && selected ? <><View style={styles.invoice}><Text style={styles.heroLabel}>PLAN SELECCIONADO</Text><View style={styles.invoiceRow}><Text style={styles.invoicePlan}>{selected.name}</Text><Text style={styles.invoiceAmount}>{money(selected.currency, selected.price)}</Text></View><Text style={styles.invoiceLine}>{selected.durationDays} días de suscripción.</Text><View style={styles.divider}/><View style={styles.invoiceRow}><Text style={styles.invoiceTotal}>Total a pagar</Text><Text style={styles.invoiceTotal}>{money(selected.currency, selected.price)}</Text></View></View><View style={styles.paymentCard}><Text style={styles.step}>PASO 2 DE 2</Text><Text style={styles.sectionTitle}>Método de pago</Text><View style={styles.methods}>{methods.map(item => <Pressable key={item.code} onPress={() => setMethod(item)} style={[styles.method, method?.code === item.code && styles.methodSelected]}><Text style={styles.methodTitle}>{item.code === "MOTO_EXPRESS" ? "Depósito" : "Transferencia"}</Text><Text style={styles.methodText}>{item.instructions}</Text></Pressable>)}</View><Button title={busy ? "Generando referencia…" : "Generar referencia"} disabled={busy || !method} onPress={() => void createOrder()} /></View></> : null}
    {created && stage === "payment" ? <><View style={styles.invoice}><Text style={styles.heroLabel}>PLAN SELECCIONADO</Text><View style={styles.invoiceRow}><Text style={styles.invoicePlan}>{created.order.planNameSnapshot}</Text><Text style={styles.invoiceAmount}>{money(created.payment.currency, created.payment.amount)}</Text></View><Text style={styles.invoiceLine}>30 días de suscripción.</Text><View style={styles.divider}/><View style={styles.invoiceRow}><Text style={styles.invoiceTotal}>Total a pagar</Text><Text style={styles.invoiceTotal}>{money(created.payment.currency, created.payment.amount)}</Text></View></View><View style={styles.paymentCard}><Text style={styles.step}>CONFIRMA TU PAGO</Text><Text style={styles.sectionTitle}>{created.method.code === "MOTO_EXPRESS" ? "Depósito" : "Transferencia"}</Text><Text style={styles.paymentInfo}>Titular: {receiver.holderName || "Pendiente de configurar"}{"\n"}Banco receptor: {receiver.bank || "Pendiente de configurar"}{"\n"}Cuenta: {receiver.account || "Pendiente de configurar"}{"\n\n"}Referencia MotoYa: {created.payment.externalReference}</Text><Text style={styles.inputLabel}>Banco de origen</Text><Pressable accessibilityRole="button" onPress={() => setBankPickerOpen(true)} style={styles.selectInput}><Text style={[styles.selectInputText, !bank && styles.selectPlaceholder]}>{bank || "Selecciona tu banco"}</Text><Text style={styles.selectChevron}>⌄</Text></Pressable><Modal transparent visible={bankPickerOpen} animationType="fade" onRequestClose={() => setBankPickerOpen(false)}><Pressable style={styles.modalShade} onPress={() => setBankPickerOpen(false)}><View style={styles.bankModal}><Text style={styles.bankModalTitle}>Banco de origen</Text>{banks.map(item => <Pressable key={item} onPress={() => { setBank(item); setBankPickerOpen(false); }} style={styles.bankOption}><Text style={[styles.bankOptionText, bank === item && styles.bankOptionTextSelected]}>{item}</Text>{bank === item ? <Text style={styles.bankCheck}>✓</Text> : null}</Pressable>)}</View></Pressable></Modal>{created.method.code === "BANK_TRANSFER" ? <><Text style={styles.inputLabel}>Número de transferencia</Text><TextInput value={transferRef} onChangeText={setTransferRef} placeholder="Referencia del banco" placeholderTextColor="#8490A7" style={styles.input}/></> : null}<Pressable onPress={chooseProof} style={styles.proof}>{proof ? <Image source={{ uri: proof }} style={styles.proofImage}/> : <><Text style={styles.proofIcon}>▣</Text><Text style={styles.proofText}>Adjunta foto o captura del comprobante</Text></>}</Pressable><Button title={busy ? "Enviando a revisión…" : "Enviar pago a revisión"} disabled={busy || !bank || !proof || (created.method.code === "BANK_TRANSFER" && !transferRef.trim())} onPress={() => void sendPayment()}/></View></> : null}
    {busy ? <ActivityIndicator color={theme.orange} style={styles.loader}/> : null}
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { padding: 18, paddingBottom: 116, backgroundColor: theme.canvas }, back: { color: theme.orange, fontWeight: "900", marginBottom: 15 }, eyebrow: { color: theme.orange, fontSize: 12, fontWeight: "900", letterSpacing: 1.3 }, title: { color: theme.text, fontSize: 29, fontWeight: "900", marginTop: 4 }, subtitle: { color: theme.muted, fontSize: 14, lineHeight: 20, marginTop: 4 }, activeHero: { marginTop: 16, padding: 20, borderRadius: 26, backgroundColor: theme.panel }, heroLabel: { color: theme.orange, fontSize: 11, fontWeight: "900", letterSpacing: 1.1 }, activeName: { color: theme.white, fontSize: 24, fontWeight: "900", marginTop: 6 }, activeText: { color: "#D2DBE9", fontSize: 14, marginTop: 7 }, detailCard: { marginTop: 13, padding: 16, borderRadius: 22, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.line }, detailTitle: { color: theme.text, fontSize: 17, fontWeight: "900" }, stats: { flexDirection: "row", gap: 10, marginTop: 12 }, stat: { flex: 1, padding: 13, borderRadius: 15, backgroundColor: "#EEF3FA" }, statValue: { color: theme.text, fontSize: 21, fontWeight: "900" }, statLabel: { color: theme.muted, fontSize: 12, marginTop: 3 }, detailText: { color: theme.muted, lineHeight: 19, marginTop: 13 }, button: { minHeight: 51, borderRadius: 16, backgroundColor: theme.orange, alignItems: "center", justifyContent: "center", marginTop: 15, paddingHorizontal: 16 }, buttonText: { color: theme.white, fontWeight: "900", fontSize: 15 }, secondaryButton: { backgroundColor: theme.white, borderWidth: 1, borderColor: theme.line }, secondaryText: { color: theme.text }, disabled: { opacity: .45 }, pendingCard: { marginTop: 16, padding: 17, borderRadius: 22, backgroundColor: "#FFF4DE", borderWidth: 1, borderColor: "#FFD697" }, pendingLabel: { color: "#A35C0B", fontSize: 11, fontWeight: "900", letterSpacing: 1 }, pendingTitle: { color: "#47240B", fontSize: 18, fontWeight: "900", marginTop: 6 }, pendingText: { color: "#744610", lineHeight: 20, marginTop: 8 }, reference: { color: "#7B4D1A", fontSize: 13, fontWeight: "800", marginTop: 10 }, step: { color: theme.orange, fontSize: 11, fontWeight: "900", letterSpacing: 1.1, marginTop: 20 }, sectionTitle: { color: theme.text, fontSize: 20, fontWeight: "900", marginTop: 4 }, planCard: { marginTop: 12, borderRadius: 24, padding: 17, borderWidth: 1, borderColor: "#1A254A" }, basic: { backgroundColor: "#102E5D" }, standard: { backgroundColor: "#33206E" }, premium: { backgroundColor: "#B84B0C" }, planSelected: { borderWidth: 3, borderColor: theme.orange }, planTop: { flexDirection: "row", justifyContent: "space-between", gap: 12 }, planName: { color: theme.white, fontSize: 21, fontWeight: "900" }, planDays: { color: "#E0E7F4", fontSize: 13, marginTop: 3 }, planPrice: { color: theme.white, fontSize: 16, fontWeight: "900", backgroundColor: "#FFFFFF22", paddingHorizontal: 11, paddingVertical: 8, borderRadius: 12 }, planStats: { flexDirection: "row", gap: 9, marginTop: 15 }, planMetric: { flex: 1, padding: 12, borderRadius: 15, backgroundColor: "#FFFFFF18" }, metricValue: { color: theme.white, fontSize: 18, fontWeight: "900" }, metricText: { color: "#E7EDF7", fontSize: 11, marginTop: 3 }, planDescription: { color: "#EDF2FA", lineHeight: 19, marginTop: 14 }, selectLabel: { color: "#0A1934", backgroundColor: theme.white, alignSelf: "flex-start", borderRadius: 12, overflow: "hidden", paddingHorizontal: 13, paddingVertical: 10, fontWeight: "900", marginTop: 14 }, methods: { flexDirection: "row", gap: 10, marginTop: 11 }, method: { flex: 1, minHeight: 128, padding: 13, borderRadius: 17, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.line }, methodSelected: { borderColor: theme.orange, backgroundColor: "#FFF4EC", borderWidth: 2 }, methodTitle: { color: theme.text, fontWeight: "900", fontSize: 16 }, methodText: { color: theme.muted, fontSize: 12, lineHeight: 17, marginTop: 7 }, invoice: { marginTop: 17, padding: 17, borderRadius: 22, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.line }, invoiceRow: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" }, invoicePlan: { color: theme.text, fontWeight: "900", fontSize: 18 }, invoiceAmount: { color: theme.text, fontWeight: "900", fontSize: 18 }, invoiceLine: { color: theme.muted, marginTop: 5 }, divider: { height: 1, backgroundColor: theme.line, marginVertical: 16 }, invoiceTotal: { color: theme.text, fontWeight: "900", fontSize: 16 }, paymentCard: { marginTop: 14, padding: 17, borderRadius: 22, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.line }, paymentInfo: { color: theme.muted, lineHeight: 20, marginTop: 12 }, inputLabel: { color: theme.text, fontSize: 12, fontWeight: "900", marginTop: 15, marginBottom: 6 }, input: { minHeight: 49, borderRadius: 14, paddingHorizontal: 13, color: theme.text, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.white }, selectInput: { minHeight: 49, borderRadius: 14, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: theme.line, backgroundColor: theme.white }, selectInputText: { color: theme.text, fontSize: 14, fontWeight: "700" }, selectPlaceholder: { color: "#8490A7", fontWeight: "400" }, selectChevron: { color: theme.text, fontSize: 23 }, modalShade: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(3,7,20,.48)" }, bankModal: { backgroundColor: theme.white, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 34 }, bankModalTitle: { color: theme.text, fontSize: 19, fontWeight: "900", marginBottom: 10 }, bankOption: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: theme.line }, bankOptionText: { color: theme.text, fontSize: 15 }, bankOptionTextSelected: { color: theme.orange, fontWeight: "900" }, bankCheck: { color: theme.orange, fontSize: 18, fontWeight: "900" }, proof: { minHeight: 145, marginTop: 16, borderRadius: 17, backgroundColor: "#F7FAFD", borderWidth: 1, borderColor: "#C7D2E1", borderStyle: "dashed", alignItems: "center", justifyContent: "center", overflow: "hidden" }, proofImage: { width: "100%", height: 190 }, proofIcon: { color: theme.orange, fontSize: 28, fontWeight: "900" }, proofText: { color: theme.muted, fontWeight: "800", marginTop: 7, textAlign: "center" }, loader: { marginTop: 16 }
});
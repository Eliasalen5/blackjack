// Capa de datos: usa Firebase Firestore si está configurado,
// y si no, guarda en localStorage (modo demo).

const DataService = (() => {
  const DEMO_KEY = "blackjack_sessions_demo";
  let db = null;

  function firebaseReady() {
    return (
      typeof firebase !== "undefined" &&
      FIREBASE_CONFIG &&
      FIREBASE_CONFIG.apiKey
    );
  }

  function init() {
    if (firebaseReady()) {
      firebase.initializeApp(FIREBASE_CONFIG);
      db = firebase.firestore();
    }
  }

  function demoRead() {
    try {
      return JSON.parse(localStorage.getItem(DEMO_KEY) || "[]");
    } catch (e) {
      return [];
    }
  }

  function demoWrite(list) {
    localStorage.setItem(DEMO_KEY, JSON.stringify(list));
  }

  async function getSessions() {
    if (db) {
      const snap = await db.collection("sessions").orderBy("date", "asc").get();
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }
    return demoRead();
  }

  async function addSession(session) {
    if (db) {
      const ref = await db.collection("sessions").add(session);
      return { id: ref.id, ...session };
    }
    const item = { id: "d" + Date.now(), ...session };
    const list = demoRead();
    list.push(item);
    demoWrite(list);
    return item;
  }

  async function updateSession(id, session) {
    if (db) {
      await db.collection("sessions").doc(id).update(session);
      return;
    }
    const list = demoRead().map((s) => (s.id === id ? { ...s, ...session } : s));
    demoWrite(list);
  }

  async function deleteSession(id) {
    if (db) {
      await db.collection("sessions").doc(id).delete();
      return;
    }
    demoWrite(demoRead().filter((s) => s.id !== id));
  }

  return {
    init,
    getSessions,
    addSession,
    updateSession,
    deleteSession,
    firebaseReady,
  };
})();

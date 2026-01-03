import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { getDatabase, ref, onValue, update, set } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";

// CONFIGURACIÓN FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyDbWrR0i5Mp0otn6Caq7PHG1ufzE_cAxmk",
    authDomain: "mi-taller-3ea2b.firebaseapp.com",
    projectId: "mi-taller-3ea2b",
    storageBucket: "mi-taller-3ea2b.firebasestorage.app",
    messagingSenderId: "1083751146344",
    appId: "1:1083751146344:web:77395408533a8690ddecdd"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

let tools = [], categories = [], budgetHistory = [], budgetItems = [], userUID = null;

// --- 1. AUTENTICACIÓN ---
const login = async () => {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-password').value;
    try { await signInWithEmailAndPassword(auth, e, p); } 
    catch (err) { alert("Error: " + err.message); }
};

const register = async () => {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-password').value;
    try {
        const cred = await createUserWithEmailAndPassword(auth, e, p);
        await set(ref(db, 'users/' + cred.user.uid), {
            categories: ['Mecánica', 'Electricidad'],
            tools: [],
            history: []
        });
    } catch (err) { alert("Error al registrar: " + err.message); }
};

onAuthStateChanged(auth, (user) => {
    userUID = user ? user.uid : null;
    document.getElementById('login-screen').style.display = user ? 'none' : 'flex';
    document.getElementById('app-content').style.display = user ? 'block' : 'none';
    if (user) initApp();
});

// --- 2. NÚCLEO DE DATOS ---
function initApp() {
    onValue(ref(db, `users/${userUID}`), (snap) => {
        const data = snap.val() || {};
        tools = data.tools || [];
        categories = data.categories || ['General'];
        budgetHistory = data.history || [];
        renderCategories();
        renderTools();
        renderHistory();
    });
}

const sync = () => update(ref(db, `users/${userUID}`), { tools, categories, history: budgetHistory });

// --- 3. CATEGORÍAS Y HERRAMIENTAS ---
window.deleteCategory = (i) => { categories.splice(i, 1); sync(); };
window.toggleLoan = (i) => {
    if (!tools[i].inUse) {
        const p = prompt("¿Quién retira?");
        if (p) { tools[i].inUse = true; tools[i].borrowedTo = p; }
    } else { tools[i].inUse = false; tools[i].borrowedTo = ''; }
    sync();
};

function renderCategories() {
    document.getElementById('category-tags').innerHTML = categories.map((c, i) => 
        `<div class="category-tag">${c} <span onclick="window.deleteCategory(${i})">×</span></div>`).join('');
    document.getElementById('tool-category-select').innerHTML = categories.map(c => `<option>${c}</option>`).join('');
}

function renderTools() {
    document.getElementById('tool-list').innerHTML = tools.map((t, i) => `
        <div class="tool-card ${t.inUse ? 'busy' : 'free'}">
            <h4>${t.name}</h4>
            <p>📍 ${t.location || 'S/U'}</p>
            <button onclick="window.toggleLoan(${i})">${t.inUse ? 'Devolver' : 'Prestar'}</button>
        </div>`).join('');
}

// --- 4. CALCULADORA Y PDF ---
function calculateTotals() {
    const hRate = parseFloat(document.getElementById('hourly-rate').value) || 0;
    const overhead = (parseFloat(document.getElementById('overhead-percent').value) || 0) / 100;
    let sub = 0;
    budgetItems.forEach(it => sub += (it.type === 'Material' ? it.price * 1.2 : it.price * hRate));
    const tax = sub * overhead;
    const total = sub + tax;
    document.getElementById('subtotal-val').innerText = `$${sub.toFixed(2)}`;
    document.getElementById('tax-val').innerText = `$${tax.toFixed(2)}`;
    document.getElementById('total-budget').innerText = `$${total.toFixed(2)}`;
    return { sub, tax, total };
}

async function generatePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const client = document.getElementById('client-name').value || "Cliente";
    doc.text(`Presupuesto: ${client}`, 10, 10);
    budgetItems.forEach((it, i) => doc.text(`${it.desc}: $${it.price}`, 10, 20 + (i * 10)));
    doc.save(`Presupuesto_${client}.pdf`);
}

// --- 5. HISTORIAL Y GANANCIAS ---
function renderHistory() {
    const now = new Date();
    let totalMes = 0;
    document.getElementById('history-table-body').innerHTML = budgetHistory.map(h => {
        const d = new Date(h.date);
        if (d.getMonth() === now.getMonth()) totalMes += h.total;
        return `<tr><td><input type="checkbox" class="h-check" data-id="${h.id}"></td>
                <td>${d.toLocaleDateString()}</td><td>${h.client}</td><td>$${h.total.toFixed(2)}</td></tr>`;
    }).join('');
    document.getElementById('monthly-earnings-total').innerText = `$${totalMes.toFixed(2)}`;
}

// --- EVENTOS DOM ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-login-action').onclick = login;
    document.getElementById('btn-register-action').onclick = register;
    document.getElementById('btn-logout-action').onclick = () => signOut(auth);
    
    document.getElementById('tool-form').onsubmit = (e) => {
        e.preventDefault();
        tools.push({
            name: document.getElementById('tool-name').value,
            location: document.getElementById('tool-location').value,
            category: document.getElementById('tool-category-select').value,
            inUse: false
        });
        sync(); e.target.reset();
    };

    document.getElementById('btn-add-budget-item').onclick = () => {
        const desc = document.getElementById('budget-item').value;
        const price = parseFloat(document.getElementById('budget-price').value);
        if (desc && price) {
            budgetItems.push({ desc, price, type: document.getElementById('item-type').value });
            calculateTotals();
            document.getElementById('budget-list').innerHTML = budgetItems.map(it => `<div>${it.desc} - $${it.price}</div>`).join('');
        }
    };

    document.getElementById('btn-finish-work').onclick = () => {
        const res = calculateTotals();
        budgetHistory.push({
            id: Date.now(),
            date: new Date().toISOString(),
            client: document.getElementById('client-name').value || "General",
            total: res.total
        });
        budgetItems = [];
        sync();
    };

    document.getElementById('btn-delete-selected').onclick = () => {
        const selected = Array.from(document.querySelectorAll('.h-check:checked')).map(cb => cb.dataset.id);
        budgetHistory = budgetHistory.filter(h => !selected.includes(h.id.toString()));
        sync();
    };
    
    document.getElementById('btn-generate-pdf').onclick = generatePDF;
});

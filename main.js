import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { getDatabase, ref, onValue, update, set } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";

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

let tools = [], categories = [], budgetHistory = [], budgetItems = [];
let userUID = null;

// --- AUTH MULTITALLER ---
window.login = () => {
    const e = document.getElementById('login-email').value, p = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, e, p).catch(err => alert("Error: " + err.message));
};

window.register = () => {
    const e = document.getElementById('login-email').value, p = document.getElementById('login-password').value;
    createUserWithEmailAndPassword(auth, e, p).then(cred => {
        // Inicializar datos para el nuevo usuario
        set(ref(db, 'users/' + cred.user.uid), {
            categories: ['Manual', 'Eléctrica', 'Neumática'],
            tools: [],
            history: []
        });
    }).catch(err => alert("Error: " + err.message));
};

window.logout = () => signOut(auth);

onAuthStateChanged(auth, (user) => {
    if (user) {
        userUID = user.uid;
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-content').style.display = 'block';
        initApp();
    } else {
        document.getElementById('app-content').style.display = 'none';
        document.getElementById('login-screen').style.display = 'flex';
    }
});

// --- LÓGICA DE DATOS PRIVADOS ---
function initApp() {
    onValue(ref(db, `users/${userUID}`), (snap) => {
        const data = snap.val() || {};
        tools = data.tools || [];
        categories = data.categories || ['General'];
        budgetHistory = data.history || [];
        renderCategories();
        renderTools();
        updateEarnings();
    });
}

function sync() {
    update(ref(db, `users/${userUID}`), { tools, categories, history: budgetHistory });
}

// --- CALCULADORA AVANZADA ---
window.addBudgetItem = () => {
    const desc = document.getElementById('budget-item').value;
    const price = parseFloat(document.getElementById('budget-price').value);
    const type = document.getElementById('item-type').value;

    if(desc && price) {
        budgetItems.push({ desc, price, type });
        calculateTotals();
        renderBudget();
    }
};

function calculateTotals() {
    const hRate = parseFloat(document.getElementById('hourly-rate').value) || 0;
    const overhead = (parseFloat(document.getElementById('overhead-percent').value) || 0) / 100;
    const materialMarkup = 1.20; // 20% de ganancia sobre materiales

    let matSum = 0;
    let laborSum = 0;

    budgetItems.forEach(it => {
        if(it.type === 'Material') matSum += (it.price * materialMarkup);
        else laborSum += (it.price * hRate); // Aquí price actúa como "horas"
    });

    const subtotal = matSum + laborSum;
    const total = subtotal * (1 + overhead);

    document.getElementById('subtotal-val').textContent = subtotal.toFixed(2);
    document.getElementById('budget-total').textContent = total.toFixed(2);
}

// --- RENDERIZADO Y EXPORTACIÓN ---
window.renderTools = () => {
    const list = document.getElementById('tool-list');
    const search = document.getElementById('search-bar').value.toLowerCase();
    list.innerHTML = tools.filter(t => t.name.toLowerCase().includes(search) || t.location.toLowerCase().includes(search)).map((t, i) => `
        <div class="tool-card" style="border-left-color: ${t.inUse ? 'red' : 'green'}">
            <span class="status-badge ${t.inUse ? 'in-use' : 'available'}">${t.inUse ? 'Ocupado' : 'Libre'}</span>
            <h4>${t.name}</h4>
            <p>📍 ${t.location || 'Sin ubicación'}</p>
            <p>👤 ${t.borrowedTo || '-'}</p>
            <button onclick="toggleLoan(${i})">${t.inUse ? 'Devolver' : 'Prestar'}</button>
        </div>
    `).join('');
};

window.toggleLoan = (i) => {
    if(!tools[i].inUse) {
        const p = prompt("¿Quién retira?");
        if(p) { tools[i].inUse = true; tools[i].borrowedTo = p; }
    } else {
        tools[i].inUse = false; tools[i].borrowedTo = '';
    }
    sync();
};

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

function renderCategories() {
    document.getElementById('tool-category-select').innerHTML = categories.map(c => `<option>${c}</option>`).join('');
}

function renderBudget() {
    document.getElementById('budget-body').innerHTML = budgetItems.map((it, i) => `
        <tr><td>${it.type}</td><td>${it.desc}</td><td>$${it.price}</td><td onclick="budgetItems.splice(${i},1);renderBudget();calculateTotals()">❌</td></tr>
    `).join('');
}

window.processAndSaveBudget = () => {
    const total = parseFloat(document.getElementById('budget-total').textContent);
    const client = document.getElementById('client-name').value || "Cliente";
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text(`PRESUPUESTO - CLIENTE: ${client}`, 10, 10);
    doc.text(`TOTAL FINAL: $${total}`, 10, 40);
    doc.save(`Presupuesto_${client}.pdf`);

    budgetHistory.push({ amount: total, date: new Date().toISOString() });
    budgetItems = []; renderBudget();
    sync();
};

function updateEarnings() {
    const total = budgetHistory.reduce((acc, h) => acc + h.amount, 0);
    document.getElementById('monthly-earnings').textContent = `$${total.toFixed(2)}`;
}

document.getElementById('search-bar').oninput = () => renderTools();
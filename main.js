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

// --- AUTENTICACIÓN Y REGISTRO ---
window.login = () => {
    const e = document.getElementById('login-email').value, p = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, e, p).catch(err => showError(err.message));
};

window.register = () => {
    const e = document.getElementById('login-email').value, p = document.getElementById('login-password').value;
    createUserWithEmailAndPassword(auth, e, p).then(cred => {
        set(ref(db, 'users/' + cred.user.uid), {
            categories: ['Manual', 'Eléctrica'],
            tools: [],
            history: []
        });
    }).catch(err => showError(err.message));
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

// --- LÓGICA DE DATOS ---
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

// --- CATEGORÍAS PERSONALIZADAS ---
window.addCategory = () => {
    const val = document.getElementById('new-category-name').value.trim();
    if(val && !categories.includes(val)) {
        categories.push(val);
        document.getElementById('new-category-name').value = '';
        sync();
    }
};

window.deleteCategory = (index) => {
    if(confirm("¿Eliminar categoría?")) {
        categories.splice(index, 1);
        sync();
    }
};

function renderCategories() {
    const tags = document.getElementById('category-tags');
    const select = document.getElementById('tool-category-select');
    tags.innerHTML = categories.map((c, i) => `<div class="category-tag">${c} <span onclick="deleteCategory(${i})">×</span></div>`).join('');
    select.innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join('');
}

// --- INVENTARIO Y UBICACIÓN ---
document.getElementById('tool-form').onsubmit = (e) => {
    e.preventDefault();
    tools.push({
        name: document.getElementById('tool-name').value,
        location: document.getElementById('tool-location').value,
        category: document.getElementById('tool-category-select').value,
        inUse: false, borrowedTo: ''
    });
    sync(); e.target.reset();
};

window.renderTools = () => {
    const list = document.getElementById('tool-list');
    const search = document.getElementById('search-bar').value.toLowerCase();
    list.innerHTML = tools.filter(t => 
        t.name.toLowerCase().includes(search) || 
        t.location.toLowerCase().includes(search) ||
        t.borrowedTo.toLowerCase().includes(search)
    ).map((t, i) => `
        <div class="tool-card" style="border-left: 6px solid ${t.inUse ? '#e74c3c' : '#27ae60'}">
            <span class="status-badge ${t.inUse ? 'in-use' : 'available'}">${t.inUse ? 'PRESTADA' : 'DISPONIBLE'}</span>
            <h4>${t.name}</h4>
            <p>📍 Ubicación: <strong>${t.location || 'No definida'}</strong></p>
            <p>📁 Cat: ${t.category}</p>
            ${t.inUse ? `<p>👤 Poseedor: ${t.borrowedTo}</p>` : ''}
            <button onclick="toggleLoan(${i})" class="btn-primary">${t.inUse ? 'Devolver' : 'Prestar'}</button>
            <button onclick="deleteTool(${i})" style="background:#888">Eliminar</button>
        </div>
    `).join('');
};

window.toggleLoan = (i) => {
    if(!tools[i].inUse) {
        const p = prompt("¿Quién retira la herramienta?");
        if(p) { tools[i].inUse = true; tools[i].borrowedTo = p; }
    } else {
        tools[i].inUse = false; tools[i].borrowedTo = '';
    }
    sync();
};

window.deleteTool = (i) => { if(confirm("¿Borrar herramienta?")) { tools.splice(i,1); sync(); } };

// --- CALCULADORA DE PRESUPUESTO ---
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
    let subtotal = 0;

    budgetItems.forEach(it => {
        subtotal += (it.type === 'Material') ? (it.price * 1.20) : (it.price * hRate);
    });

    const total = subtotal * (1 + overhead);
    document.getElementById('subtotal-val').textContent = subtotal.toFixed(2);
    document.getElementById('budget-total').textContent = total.toFixed(2);
}

function renderBudget() {
    document.getElementById('budget-body').innerHTML = budgetItems.map((it, i) => `
        <tr>
            <td>${it.type === 'Material' ? '📦' : '👨‍🔧'}</td>
            <td>${it.desc}</td>
            <td>$${it.price}</td>
            <td onclick="budgetItems.splice(${i},1);calculateTotals();renderBudget()" style="cursor:pointer;color:red">×</td>
        </tr>`).join('');
}

window.processAndSaveBudget = () => {
    const total = parseFloat(document.getElementById('budget-total').textContent);
    const client = document.getElementById('client-name').value || "Cliente";
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(20); doc.text("PRESUPUESTO PROFESIONAL", 105, 20, {align: 'center'});
    doc.setFontSize(12); doc.text(`Cliente: ${client}`, 20, 40);
    doc.text(`Total: $${total.toFixed(2)}`, 20, 50);
    doc.save(`Presupuesto_${client}.pdf`);

    budgetHistory.push({ amount: total, date: new Date().toISOString() });
    budgetItems = []; renderBudget(); calculateTotals();
    sync();
};

function updateEarnings() {
    const total = budgetHistory.reduce((acc, h) => acc + h.amount, 0);
    document.getElementById('monthly-earnings').textContent = `$${total.toFixed(2)}`;
}

function showError(msg) {
    const err = document.getElementById('auth-error');
    err.style.display = 'block'; err.innerText = msg;
}

document.getElementById('search-bar').oninput = () => renderTools();

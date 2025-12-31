// CONFIGURACIÓN DE FIREBASE
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC5ILMLM7lkAt9peWDd1GVgm-iQfEfPh5E",
  authDomain: "mi-taller-1fdd6.firebaseapp.com",
  databaseURL: "https://mi-taller-1fdd6-default-rtdb.firebaseio.com",
  projectId: "mi-taller-1fdd6",
  storageBucket: "mi-taller-1fdd6.firebasestorage.app",
  messagingSenderId: "788590868790",
  appId: "1:788590868790:web:be567d5f663238d2b01b97",
  measurementId: "G-LHXBYDN7GZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Inicialización
const db = firebase.database();
const auth = firebase.auth();

// Variables de Estado
let tools = [], categories = [], budgetHistory = [], budgetItems = [];

// --- SEGURIDAD Y LOGIN ---
function login() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    auth.signInWithEmailAndPassword(email, pass).catch(err => {
        document.getElementById('auth-error').style.display = 'block';
    });
}

function logout() { auth.signOut(); }

auth.onAuthStateChanged(user => {
    if (user) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-content').style.display = 'block';
        initApp();
    } else {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('app-content').style.display = 'none';
    }
});

// --- CARGA DE DATOS ---
function initApp() {
    db.ref('/').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            tools = data.tools || [];
            categories = data.categories || ['Manual', 'Eléctrica'];
            budgetHistory = data.history || [];
            renderCategories();
            renderTools();
            updateEarnings();
        }
    });
}

function syncCloud() {
    db.ref('/').update({ tools, categories, history: budgetHistory });
}

// --- CATEGORÍAS ---
function renderCategories() {
    const select = document.getElementById('tool-category-select');
    const tags = document.getElementById('category-tags');
    select.innerHTML = ''; tags.innerHTML = '';
    categories.forEach((cat, i) => {
        select.innerHTML += `<option value="${cat}">${cat}</option>`;
        tags.innerHTML += `<div class="category-tag">${cat} <span onclick="deleteCategory(${i})" style="cursor:pointer">×</span></div>`;
    });
}

function addCategory() {
    const val = document.getElementById('new-category-name').value.trim();
    if(val) { categories.push(val); syncCloud(); document.getElementById('new-category-name').value = ''; }
}

function deleteCategory(i) {
    if(confirm("¿Eliminar categoría?")) { categories.splice(i, 1); syncCloud(); }
}

// --- HERRAMIENTAS ---
function renderTools() {
    const list = document.getElementById('tool-list');
    const search = document.getElementById('search-bar').value.toLowerCase();
    list.innerHTML = '';

    tools.forEach((tool, i) => {
        if (tool.name.toLowerCase().includes(search) || tool.borrowedTo.toLowerCase().includes(search)) {
            const card = document.createElement('div');
            card.className = 'tool-card';
            card.style.borderLeftColor = tool.inUse ? '#e74c3c' : '#27ae60';
            card.innerHTML = `
                <span class="status-badge ${tool.inUse ? 'in-use' : 'available'}">
                    ${tool.inUse ? '📍 EN USO' : '✅ DISPONIBLE'}
                </span>
                <h3>${tool.name}</h3>
                <p>Categoría: <strong>${tool.category}</strong></p>
                ${tool.inUse ? `<p>Poseedor: <strong>${tool.borrowedTo}</strong></p>` : ''}
                <div class="flex-row" style="margin-top:15px">
                    <button onclick="toggleLoan(${i})" class="btn-primary" style="flex:2">
                        ${tool.inUse ? 'Devolver' : 'Prestar'}
                    </button>
                    <button onclick="deleteTool(${i})" class="btn-primary" style="background:#888; flex:1">Eliminar</button>
                </div>
            `;
            list.appendChild(card);
        }
    });
}

document.getElementById('tool-form').onsubmit = (e) => {
    e.preventDefault();
    tools.push({
        name: document.getElementById('tool-name').value,
        category: document.getElementById('tool-category-select').value,
        inUse: false, borrowedTo: ''
    });
    syncCloud(); e.target.reset();
};

function toggleLoan(i) {
    if(!tools[i].inUse) {
        const p = prompt("¿Quién retira la herramienta?");
        if(p) { tools[i].inUse = true; tools[i].borrowedTo = p; }
    } else {
        tools[i].inUse = false; tools[i].borrowedTo = '';
    }
    syncCloud();
}

function deleteTool(i) { if(confirm("¿Borrar herramienta?")) { tools.splice(i,1); syncCloud(); } }

// --- PRESUPUESTOS ---
function addBudgetItem() {
    const d = document.getElementById('budget-item'), p = document.getElementById('budget-price');
    if(d.value && p.value) {
        budgetItems.push({ desc: d.value, price: parseFloat(p.value) });
        d.value = ''; p.value = ''; renderBudget();
    }
}

function renderBudget() {
    const body = document.getElementById('budget-body');
    let total = 0; body.innerHTML = '';
    budgetItems.forEach((item, i) => {
        total += item.price;
        body.innerHTML += `<tr><td>${item.desc}</td><td>$${item.price.toFixed(2)}</td><td onclick="removeBudgetItem(${i})" style="color:red; cursor:pointer">×</td></tr>`;
    });
    document.getElementById('budget-total').textContent = total.toFixed(2);
}

function removeBudgetItem(i) { budgetItems.splice(i, 1); renderBudget(); }

function updateEarnings() {
    const m = new Date().getMonth(), y = new Date().getFullYear();
    const total = budgetHistory.reduce((acc, h) => {
        const d = new Date(h.date);
        return (d.getMonth() === m && d.getFullYear() === y) ? acc + h.amount : acc;
    }, 0);
    document.getElementById('monthly-earnings').textContent = `$${total.toFixed(2)}`;
}

async function processAndSaveBudget() {
    const client = document.getElementById('client-name').value || "Cliente General";
    if(budgetItems.length === 0) return alert("El presupuesto está vacío");

    const total = budgetItems.reduce((s, i) => s + i.price, 0);

    // PDF con jsPDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(20); doc.text("PRESUPUESTO DE TRABAJO", 20, 20);
    doc.setFontSize(12); doc.text(`Cliente: ${client}`, 20, 35);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 150, 35);
    let y = 50;
    budgetItems.forEach(it => { doc.text(`${it.desc}`, 20, y); doc.text(`$${it.price}`, 160, y); y+=10; });
    doc.line(20, y, 190, y);
    doc.setFontSize(14); doc.text(`TOTAL: $${total.toFixed(2)}`, 140, y + 10);
    doc.save(`Presupuesto_${client}.pdf`);

    // Guardar en Nube
    budgetHistory.push({ amount: total, date: new Date().toISOString() });
    budgetItems = []; renderBudget();
    document.getElementById('client-name').value = '';
    syncCloud();
}

document.getElementById('search-bar').oninput = () => renderTools();

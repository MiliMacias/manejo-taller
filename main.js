// 1. IMPORTACIONES DE FIREBASE
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { getDatabase, ref, onValue, update, set } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";

// 2. CONFIGURACIÓN DE TU PROYECTO
const firebaseConfig = {
    apiKey: "AIzaSyDbWrR0i5Mp0otn6Caq7PHG1ufzE_cAxmk",
    authDomain: "mi-taller-3ea2b.firebaseapp.com",
    projectId: "mi-taller-3ea2b",
    storageBucket: "mi-taller-3ea2b.firebasestorage.app",
    messagingSenderId: "1083751146344",
    appId: "1:1083751146344:web:77395408533a8690ddecdd"
};

// 3. INICIALIZACIÓN
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Variables de estado
let tools = [], categories = [], budgetHistory = [], budgetItems = [];
let userUID = null;

// --- 4. FUNCIONES DE AUTENTICACIÓN (Expuestas a window para el HTML) ---

window.login = async function() {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-password').value;
    if (!e || !p) return alert("Completa los campos");
    
    try {
        await signInWithEmailAndPassword(auth, e, p);
    } catch (err) {
        alert("Error al entrar: " + err.message);
    }
};

window.register = async function() {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-password').value;
    if (!e || !p) return alert("Completa los campos");

    try {
        const cred = await createUserWithEmailAndPassword(auth, e, p);
        // Crear estructura inicial para el nuevo usuario
        await set(ref(db, 'users/' + cred.user.uid), {
            categories: ['Manual', 'Eléctrica'],
            tools: [],
            history: []
        });
        alert("¡Taller creado con éxito!");
    } catch (err) {
        alert("Error al registrar: " + err.message);
    }
};

window.logout = () => signOut(auth);

// Observador de sesión
onAuthStateChanged(auth, (user) => {
    const loginScreen = document.getElementById('login-screen');
    const appContent = document.getElementById('app-content');
    
    if (user) {
        userUID = user.uid;
        loginScreen.style.display = 'none';
        appContent.style.display = 'block';
        initApp(); // Cargar datos del usuario
    } else {
        userUID = null;
        loginScreen.style.display = 'flex';
        appContent.style.display = 'none';
    }
});

// --- 5. LÓGICA DEL TALLER (DATOS PRIVADOS) ---

function initApp() {
    // Escuchar solo los datos del usuario logueado
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
    if (!userUID) return;
    update(ref(db, `users/${userUID}`), { 
        tools, 
        categories, 
        history: budgetHistory 
    });
}

// --- 6. CATEGORÍAS Y HERRAMIENTAS ---

window.addCategory = function() {
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
    if(tags) tags.innerHTML = categories.map((c, i) => `<div class="category-tag">${c} <span onclick="deleteCategory(${i})">×</span></div>`).join('');
    if(select) select.innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join('');
}

// Manejo del formulario de herramientas
const toolForm = document.getElementById('tool-form');
if(toolForm) {
    toolForm.onsubmit = (e) => {
        e.preventDefault();
        tools.push({
            name: document.getElementById('tool-name').value,
            location: document.getElementById('tool-location').value,
            category: document.getElementById('tool-category-select').value,
            inUse: false,
            borrowedTo: ''
        });
        sync();
        e.target.reset();
    };
}

window.renderTools = function() {
    const list = document.getElementById('tool-list');
    const search = document.getElementById('search-bar').value.toLowerCase();
    if(!list) return;

    list.innerHTML = tools.filter(t => 
        t.name.toLowerCase().includes(search) || 
        (t.location && t.location.toLowerCase().includes(search))
    ).map((t, i) => `
        <div class="tool-card" style="border-left: 6px solid ${t.inUse ? '#e74c3c' : '#27ae60'}">
            <span class="status-badge ${t.inUse ? 'in-use' : 'available'}">${t.inUse ? 'PRESTADA' : 'DISPONIBLE'}</span>
            <h4>${t.name}</h4>
            <p>📍 Ubicación: <strong>${t.location || 'No definida'}</strong></p>
            <p>📁 Cat: ${t.category}</p>
            ${t.inUse ? `<p>👤 Poseedor: ${t.borrowedTo}</p>` : ''}
            <div class="flex-row" style="margin-top:10px">
                <button onclick="toggleLoan(${i})" class="btn-primary">${t.inUse ? 'Devolver' : 'Prestar'}</button>
                <button onclick="deleteTool(${i})" style="background:#888; color:white; border:none; border-radius:4px; padding:5px">Eliminar</button>
            </div>
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

// --- 7. CALCULADORA DE PRESUPUESTO ---

window.addBudgetItem = function() {
    const desc = document.getElementById('budget-item').value;
    const price = parseFloat(document.getElementById('budget-price').value);
    const type = document.getElementById('item-type').value;
    
    if(desc && !isNaN(price)) {
        budgetItems.push({ desc, price, type });
        calculateTotals();
        renderBudget();
        document.getElementById('budget-item').value = '';
        document.getElementById('budget-price').value = '';
    }
};

function calculateTotals() {
    const hRate = parseFloat(document.getElementById('hourly-rate').value) || 0;
    const overhead = (parseFloat(document.getElementById('overhead-percent').value) || 0) / 100;
    let subtotal = 0;

    budgetItems.forEach(it => {
        // Lógica: Materiales + 20% margen | Mano de obra = Horas * Tarifa
        subtotal += (it.type === 'Material') ? (it.price * 1.20) : (it.price * hRate);
    });

    const total = subtotal * (1 + overhead);
    document.getElementById('subtotal-val').textContent =

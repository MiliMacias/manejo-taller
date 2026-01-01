// 1. IMPORTACIONES
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { getDatabase, ref, onValue, update } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";

// 2. CONFIGURACIÓN
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

let tools = [], categories = [], budgetHistory = [], budgetItems = [];

// --- AUTENTICACIÓN ---
window.login = async function() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('auth-error');

    errorDiv.style.display = 'block';
    errorDiv.innerText = "Verificando...";

    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
        errorDiv.innerText = "❌ Error: Credenciales incorrectas.";
    }
};

window.logout = () => signOut(auth);

onAuthStateChanged(auth, (user) => {
    const loginScreen = document.getElementById('login-screen');
    const appContent = document.getElementById('app-content');
    if (user) {
        loginScreen.style.display = 'none';
        appContent.style.display = 'block';
        initApp();
    } else {
        loginScreen.style.display = 'flex';
        appContent.style.display = 'none';
    }
});

// --- CARGA Y SINCRONIZACIÓN ---
function initApp() {
    onValue(ref(db, '/'), (snapshot) => {
        const data = snapshot.val() || {};
        tools = data.tools || [];
        categories = data.categories || ['Manual', 'Eléctrica'];
        budgetHistory = data.history || [];
        renderCategories();
        renderTools();
        updateEarnings();
    });
}

function syncCloud() {
    update(ref(db, '/'), { tools, categories, history: budgetHistory });
}

// --- CATEGORÍAS ---
window.addCategory = function() {
    const val = document.getElementById('new-category-name').value.trim();
    if(val && !categories.includes(val)) {
        categories.push(val);
        syncCloud();
        document.getElementById('new-category-name').value = '';
    }
};

window.deleteCategory = function(i) {
    if(confirm("¿Eliminar categoría?")) {
        categories.splice(i, 1);
        syncCloud();
    }
};

function renderCategories() {
    const select = document.getElementById('tool-category-select');
    const tags = document.getElementById('category-tags');
    select.innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join('');
    tags.innerHTML = categories.map((c, i) => `
        <div class="category-tag">${c} <span onclick="deleteCategory(${i})" style="cursor:pointer">×</span></div>
    `).join('');
}

// --- HERRAMIENTAS ---
document.getElementById('tool-form').onsubmit = (e) => {
    e.preventDefault();
    tools.push({
        name: document.getElementById('tool-name').value,
        category: document.getElementById('tool-category-select').value,
        inUse: false,
        borrowedTo: ''
    });
    syncCloud();
    e.target.reset();
};

window.renderTools = function() {
    const list = document.getElementById('tool-list');
    const search = document.getElementById('search-bar').value.toLowerCase();
    list.innerHTML = '';

    tools.forEach((tool, i) => {
        if (tool.name.toLowerCase().includes(search) || (tool.borrowedTo && tool.borrowedTo.toLowerCase().includes(search))) {
            const card = document.createElement('div');
            card.className = 'tool-card';
            card.style.borderLeft = `5px solid ${tool.inUse ? '#e74c3c' : '#27ae60'}`;
            card.innerHTML = `
                <span class="status-badge ${tool.inUse ? 'in-use' : 'available'}">${tool.inUse ? '📍 EN USO' : '✅ DISPONIBLE'}</span>
                <h3>${tool.name}</h3>
                <p>Categoría: <strong>${tool.category}</strong></p>
                ${tool.inUse ? `<p>Poseedor: <strong>${tool.borrowedTo}</strong></p>` : ''}
                <div class="flex-row" style="margin-top:10px; display:flex; gap:5px;">
                    <button onclick="toggleLoan(${i})" class="btn-primary" style="flex:2">${tool.inUse ? 'Devolver' : 'Prestar'}</button>
                    <button onclick="deleteTool(${i})" class="btn-primary" style="background:#888; flex:1">X</button>
                </div>`;
            list.appendChild(card);
        }
    });
};

window.toggleLoan = function(i) {
    if(!tools[i].inUse) {
        const p = prompt("¿Quién retira?");
        if(p) { tools[i].inUse = true; tools[i].borrowedTo = p; }
    } else {
        tools[i].inUse = false; tools[i].borrowedTo = '';
    }
    syncCloud();
};

window.deleteTool = (i) => { if(confirm("¿Borrar?")) { tools.splice(i,1); syncCloud(); } };

// --- PRESUPUESTOS ---
// Modificamos el guardado de items para incluir el TIPO (Material/Mano de Obra)
window.addBudgetItem = function() {
    const d = document.getElementById('budget-item'), 
          p = document.getElementById('budget-price'),
          t = document.getElementById('item-type');
          
    if(d.value && p.value) {
        budgetItems.push({ 
            desc: d.value, 
            price: parseFloat(p.value),
            type: t.value 
        });
        d.value = ''; p.value = ''; 
        renderBudget();
    }
};

function renderBudget() {
    const body = document.getElementById('budget-body');
    let total = 0;
    body.innerHTML = budgetItems.map((item, i) => {
        total += item.price;
        return `<tr>
            <td><small>${item.type}</small></td>
            <td>${item.desc}</td>
            <td>$${item.price.toFixed(2)}</td>
            <td onclick="removeBudgetItem(${i})" style="color:red; cursor:pointer">×</td>
        </tr>`;
    }).join('');
    document.getElementById('budget-total').textContent = total.toFixed(2);
}

window.processAndSaveBudget = async function() {
    const client = document.getElementById('client-name').value || "Cliente General";
    const clientInfo = document.getElementById('client-address').value || "N/A";
    const provider = document.getElementById('provider-name').value || "Taller";
    const providerContact = document.getElementById('provider-contact').value || "";
    const workDate = document.getElementById('work-date').value || "A convenir";
    
    if(budgetItems.length === 0) return alert("Agrega materiales o mano de obra");

    const total = budgetItems.reduce((s, i) => s + i.price, 0);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // --- ENCABEZADO Y FECHAS ---
    doc.setFontSize(20);
    doc.text("PRESUPUESTO DE TRABAJO", 105, 20, { align: "center" });
    
    doc.setFontSize(10);
    doc.text(`Fecha de emisión: ${new Date().toLocaleDateString()}`, 150, 30);
    doc.text(`Fecha est. de trabajo: ${workDate}`, 150, 35);

    // --- BLOQUE DE CONTACTOS ---
    doc.setFont("helvetica", "bold");
    doc.text("DE (Presupuestador):", 20, 45);
    doc.text("PARA (Cliente):", 110, 45);
    
    doc.setFont("helvetica", "normal");
    doc.text(`${provider}`, 20, 50);
    doc.text(`${providerContact}`, 20, 55);
    
    doc.text(`${client}`, 110, 50);
    doc.text(`${clientInfo}`, 110, 55);

    // --- TABLA DE COSTOS ---
    doc.line(20, 65, 190, 65);
    doc.setFont("helvetica", "bold");
    doc.text("TIPO", 22, 72);
    doc.text("DESCRIPCIÓN", 50, 72);
    doc.text("SUBTOTAL", 160, 72);
    doc.line(20, 75, 190, 75);

    doc.setFont("helvetica", "normal");
    let y = 82;
    budgetItems.forEach((it) => {
        doc.text(`${it.type}`, 22, y);
        doc.text(`${it.desc}`, 50, y);
        doc.text(`$${it.price.toFixed(2)}`, 160, y);
        y += 8;
    });

    // --- TOTALES ---
    doc.line(20, y, 190, y);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL FINAL: $${total.toFixed(2)}`, 130, y + 15);

    // Guardar PDF
    doc.save(`Presupuesto_${client}.pdf`);

    // Sincronizar con Firebase
    budgetHistory.push({ amount: total, date: new Date().toISOString(), client: client });
    budgetItems = []; renderBudget();
    syncCloud();
};

function updateEarnings() {
    const m = new Date().getMonth(), y = new Date().getFullYear();
    const total = budgetHistory.reduce((acc, h) => {
        const d = new Date(h.date);
        return (d.getMonth() === m && d.getFullYear() === y) ? acc + h.amount : acc;
    }, 0);
    document.getElementById('monthly-earnings').textContent = `$${total.toFixed(2)}`;
}

document.getElementById('search-bar').oninput = () => renderTools();

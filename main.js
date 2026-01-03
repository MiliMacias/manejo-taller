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
let workshopData = { name: '', phone: '', address: '' };
let userUID = null;
let editingIndex = null;

// --- AUTH ---
window.login = () => {
    const e = document.getElementById('login-email').value, p = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, e, p).catch(err => alert("Error: " + err.message));
};
window.register = () => {
    const e = document.getElementById('login-email').value, p = document.getElementById('login-password').value;
    createUserWithEmailAndPassword(auth, e, p).then(cred => {
        set(ref(db, 'users/' + cred.user.uid), { 
            categories: ['Manual', 'Eléctrica'], 
            tools: [], 
            history: [],
            workshop: { name: 'Mi Taller', phone: '', address: '' }
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

function initApp() {
    onValue(ref(db, `users/${userUID}`), (snap) => {
        const data = snap.val() || {};
        tools = data.tools || [];
        categories = data.categories || ['General'];
        budgetHistory = data.history || [];
        workshopData = data.workshop || { name: 'Mi Taller', phone: '', address: '' };
        
        // Cargar datos del taller en los inputs
        document.getElementById('ws-name').value = workshopData.name;
        document.getElementById('ws-phone').value = workshopData.phone;
        document.getElementById('ws-address').value = workshopData.address;
        document.getElementById('user-workshop-title').textContent = workshopData.name;

        renderCategories();
        renderTools();
        renderHistory();
    });
}

window.saveWorkshopData = () => {
    workshopData = {
        name: document.getElementById('ws-name').value,
        phone: document.getElementById('ws-phone').value,
        address: document.getElementById('ws-address').value
    };
    update(ref(db, `users/${userUID}`), { workshop: workshopData });
    alert("Datos del taller actualizados");
};

function sync() {
    update(ref(db, `users/${userUID}`), { tools, categories, history: budgetHistory });
}

// --- CATEGORÍAS & HERRAMIENTAS (Lógica anterior mantenida) ---
window.addCategory = () => {
    const val = document.getElementById('new-category-name').value.trim();
    if(val && !categories.includes(val)) { categories.push(val); sync(); renderCategories(); }
};
window.deleteCategory = () => {
    const val = document.getElementById('delete-category-select').value;
    if(confirm(`¿Eliminar categoría "${val}"?`)) { categories = categories.filter(c => c !== val); sync(); renderCategories(); }
};
function renderCategories() {
    const options = categories.map(c => `<option value="${c}">${c}</option>`).join('');
    document.getElementById('tool-category-select').innerHTML = options;
    document.getElementById('delete-category-select').innerHTML = options;
    document.getElementById('filter-category').innerHTML = '<option value="Todas">Todas</option>' + options;
}

document.getElementById('tool-form').onsubmit = (e) => {
    e.preventDefault();
    const toolData = {
        name: document.getElementById('tool-name').value,
        location: document.getElementById('tool-location').value,
        category: document.getElementById('tool-category-select').value,
        inUse: editingIndex !== null ? tools[editingIndex].inUse : false
    };
    if (editingIndex !== null) { tools[editingIndex] = toolData; editingIndex = null; document.getElementById('submit-tool-btn').textContent = "Añadir Herramienta"; }
    else { tools.push(toolData); }
    sync(); e.target.reset();
};

window.renderTools = () => {
    const search = document.getElementById('search-bar').value.toLowerCase();
    const filterCat = document.getElementById('filter-category').value;
    document.getElementById('tool-list').innerHTML = tools.map((t, i) => ({...t, idx: i}))
        .filter(t => (t.name.toLowerCase().includes(search)) && (filterCat === "Todas" || t.category === filterCat))
        .map(t => `<div class="tool-card"><h4>${t.name}</h4><p>${t.category} | ${t.location}</p><button onclick="editTool(${t.idx})">✏️</button></div>`).join('');
};

window.editTool = (i) => {
    editingIndex = i;
    document.getElementById('tool-name').value = tools[i].name;
    document.getElementById('submit-tool-btn').textContent = "Guardar";
};

// --- PRESUPUESTO Y PDF ---
window.addBudgetItem = () => {
    const desc = document.getElementById('budget-item').value;
    const price = parseFloat(document.getElementById('budget-price').value);
    const type = document.getElementById('item-type').value;
    if(desc && price) {
        budgetItems.push({ desc, price, type });
        renderBudget();
    }
};

window.removeBudgetItem = (i) => { budgetItems.splice(i, 1); renderBudget(); };

function renderBudget() {
    document.getElementById('budget-body').innerHTML = budgetItems.map((it, i) => `
        <tr><td>${it.type}</td><td>${it.desc}</td><td>$${it.price}</td><td><button onclick="removeBudgetItem(${i})">❌</button></td></tr>`).join('');
    calculateTotals();
}

function calculateTotals() {
    const hRate = parseFloat(document.getElementById('hourly-rate').value) || 0;
    const overhead = (parseFloat(document.getElementById('overhead-percent').value) || 0) / 100;
    let subtotal = 0;
    budgetItems.forEach(it => { subtotal += (it.type === 'Material') ? (it.price * 1.20) : (it.price * hRate); });
    const total = subtotal * (1 + overhead);
    document.getElementById('subtotal-val').textContent = subtotal.toFixed(2);
    document.getElementById('budget-total').textContent = total.toFixed(2);
}

window.processAndSaveBudget = () => {
    const total = parseFloat(document.getElementById('budget-total').textContent);
    const cName = document.getElementById('client-name').value || "Cliente";
    const cInfo = document.getElementById('client-contact').value || "Sin contacto";
    
    if(budgetItems.length === 0) return alert("Añade ítems");

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Estilo PDF
    doc.setFontSize(20); doc.text(workshopData.name.toUpperCase(), 10, 20);
    doc.setFontSize(10); 
    doc.text(`Taller: ${workshopData.address} | Tel: ${workshopData.phone}`, 10, 28);
    doc.line(10, 32, 200, 32);

    doc.setFontSize(12);
    doc.text(`CLIENTE: ${cName}`, 10, 45);
    doc.text(`CONTACTO: ${cInfo}`, 10, 52);
    doc.text(`FECHA: ${new Date().toLocaleDateString()}`, 150, 45);

    let y = 70;
    doc.setFont(undefined, 'bold');
    doc.text("Descripción", 10, y); doc.text("Tipo", 100, y); doc.text("Costo/Hs", 160, y);
    doc.setFont(undefined, 'normal');
    y += 10;
    
    budgetItems.forEach(it => {
        doc.text(it.desc, 10, y);
        doc.text(it.type, 100, y);
        doc.text(`$${it.price}`, 160, y);
        y += 8;
    });

    doc.line(10, y, 200, y);
    doc.setFontSize(14); doc.text(`TOTAL FINAL: $${total.toFixed(2)}`, 140, y + 15);

    doc.save(`Presupuesto_${cName}.pdf`);
    budgetHistory.push({ client: cName, amount: total, date: new Date().toLocaleDateString(), status: 'Pendiente' });
    budgetItems = []; renderBudget(); sync();
};

window.updateBudgetStatus = (i) => { budgetHistory[i].status = budgetHistory[i].status === 'Pendiente' ? 'Concretado' : 'Pendiente'; sync(); };
window.deleteBudget = (i) => { if(confirm("¿Eliminar?")) { budgetHistory.splice(i, 1); sync(); } };

function renderHistory() {
    let earnings = 0;
    document.getElementById('history-body').innerHTML = budgetHistory.map((h, i) => {
        if(h.status === 'Concretado') earnings += h.amount;
        return `<tr><td>${h.date}</td><td>${h.client}</td><td>$${h.amount.toFixed(2)}</td>
        <td><button onclick="updateBudgetStatus(${i})" class="${h.status === 'Pendiente' ? 'btn-warn' : 'btn-success'}">${h.status}</button></td>
        <td><button onclick="deleteBudget(${i})">🗑️</button></td></tr>`;
    }).join('');
    document.getElementById('monthly-earnings').textContent = `$${earnings.toFixed(2)}`;
}

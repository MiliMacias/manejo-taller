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
let editingIndex = null;

// --- AUTH ---
window.login = () => {
    const e = document.getElementById('login-email').value, p = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, e, p).catch(err => alert("Error: " + err.message));
};
window.register = () => {
    const e = document.getElementById('login-email').value, p = document.getElementById('login-password').value;
    createUserWithEmailAndPassword(auth, e, p).then(cred => {
        set(ref(db, 'users/' + cred.user.uid), { categories: ['Manual', 'Eléctrica'], tools: [], history: [] });
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
        renderCategories();
        renderTools();
        renderHistory();
    });
}

function sync() {
    update(ref(db, `users/${userUID}`), { tools, categories, history: budgetHistory });
}

// --- GESTIÓN CATEGORÍAS ---
window.addCategory = () => {
    const val = document.getElementById('new-category-name').value.trim();
    if(val && !categories.includes(val)) {
        categories.push(val);
        document.getElementById('new-category-name').value = '';
        sync(); renderCategories();
    }
};
window.deleteCategory = () => {
    const val = document.getElementById('delete-category-select').value;
    if(confirm(`¿Eliminar categoría "${val}"?`)) {
        categories = categories.filter(c => c !== val);
        sync(); renderCategories();
    }
};
function renderCategories() {
    const options = categories.map(c => `<option value="${c}">${c}</option>`).join('');
    document.getElementById('tool-category-select').innerHTML = options;
    document.getElementById('delete-category-select').innerHTML = options;
    document.getElementById('filter-category').innerHTML = '<option value="Todas">Todas</option>' + options;
}

// --- HERRAMIENTAS ---
document.getElementById('tool-form').onsubmit = (e) => {
    e.preventDefault();
    const toolData = {
        name: document.getElementById('tool-name').value,
        location: document.getElementById('tool-location').value,
        category: document.getElementById('tool-category-select').value,
        inUse: editingIndex !== null ? tools[editingIndex].inUse : false,
        borrowedTo: editingIndex !== null ? tools[editingIndex].borrowedTo : ''
    };
    if (editingIndex !== null) { tools[editingIndex] = toolData; editingIndex = null; document.getElementById('submit-tool-btn').textContent = "Añadir Herramienta"; }
    else { tools.push(toolData); }
    sync(); e.target.reset();
};

window.editTool = (index) => {
    editingIndex = index;
    const t = tools[index];
    document.getElementById('tool-name').value = t.name;
    document.getElementById('tool-location').value = t.location;
    document.getElementById('tool-category-select').value = t.category;
    document.getElementById('submit-tool-btn').textContent = "Guardar Cambios";
};

window.renderTools = () => {
    const list = document.getElementById('tool-list');
    const search = document.getElementById('search-bar').value.toLowerCase();
    const filterCat = document.getElementById('filter-category').value;
    list.innerHTML = tools.map((t, i) => ({...t, idx: i}))
        .filter(t => (t.name.toLowerCase().includes(search) || t.location.toLowerCase().includes(search)) && (filterCat === "Todas" || t.category === filterCat))
        .map(t => `
            <div class="tool-card" style="border-left: 5px solid ${t.inUse ? '#e74c3c' : '#2ecc71'}">
                <h4>${t.name}</h4>
                <p><small>${t.category}</small> | 📍 ${t.location}</p>
                <div class="flex-row">
                    <button onclick="toggleLoan(${t.idx})">${t.inUse ? 'Devolver' : 'Prestar'}</button>
                    <button onclick="editTool(${t.idx})" class="btn-primary">✏️</button>
                </div>
            </div>`).join('');
};

window.toggleLoan = (i) => {
    if(!tools[i].inUse) {
        const p = prompt("¿Quién retira?");
        if(p) { tools[i].inUse = true; tools[i].borrowedTo = p; }
    } else { tools[i].inUse = false; tools[i].borrowedTo = ''; }
    sync();
};

// --- PRESUPUESTO ---
window.addBudgetItem = () => {
    const desc = document.getElementById('budget-item').value;
    const price = parseFloat(document.getElementById('budget-price').value);
    const type = document.getElementById('item-type').value;
    if(desc && price) {
        budgetItems.push({ desc, price, type });
        document.getElementById('budget-item').value = '';
        document.getElementById('budget-price').value = '';
        renderBudget();
    }
};

window.removeBudgetItem = (index) => {
    budgetItems.splice(index, 1);
    renderBudget();
};

function renderBudget() {
    const tbody = document.getElementById('budget-body');
    tbody.innerHTML = budgetItems.map((it, i) => `
        <tr>
            <td>${it.type}</td>
            <td>${it.desc}</td>
            <td>$${it.price}</td>
            <td><button onclick="removeBudgetItem(${i})" style="background:none; border:none; cursor:pointer;">❌</button></td>
        </tr>`).join('');
    calculateTotals();
}

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

window.processAndSaveBudget = () => {
    const total = parseFloat(document.getElementById('budget-total').textContent);
    const client = document.getElementById('client-name').value || "Cliente";
    if(budgetItems.length === 0) return alert("Añade ítems al presupuesto");

    // PDF mejorado
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text("PRESUPUESTO DE TRABAJO", 10, 20);
    doc.setFontSize(12); doc.text(`Cliente: ${client}`, 10, 30);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 10, 37);
    let y = 50;
    budgetItems.forEach(it => {
        doc.text(`- ${it.desc} (${it.type}): $${it.price}`, 10, y);
        y += 7;
    });
    doc.setFontSize(14); doc.text(`TOTAL FINAL: $${total.toFixed(2)}`, 10, y + 10);
    doc.save(`Presupuesto_${client}.pdf`);

    budgetHistory.push({ client, amount: total, date: new Date().toLocaleDateString(), status: 'Pendiente' });
    budgetItems = []; renderBudget(); sync();
};

window.updateBudgetStatus = (i) => {
    budgetHistory[i].status = budgetHistory[i].status === 'Pendiente' ? 'Concretado' : 'Pendiente';
    sync();
};

window.deleteBudget = (i) => {
    if(confirm("¿Eliminar este registro?")) { budgetHistory.splice(i, 1); sync(); }
};

function renderHistory() {
    let earnings = 0;
    document.getElementById('history-body').innerHTML = budgetHistory.map((h, i) => {
        if(h.status === 'Concretado') earnings += h.amount;
        return `
            <tr>
                <td>${h.date}</td>
                <td>${h.client}</td>
                <td>$${h.amount.toFixed(2)}</td>
                <td><button onclick="updateBudgetStatus(${i})" class="${h.status === 'Pendiente' ? 'btn-warn' : 'btn-success'}">${h.status}</button></td>
                <td><button onclick="deleteBudget(${i})" class="btn-danger" style="padding:5px">🗑️</button></td>
            </tr>`;
    }).join('');
    document.getElementById('monthly-earnings').textContent = `$${earnings.toFixed(2)}`;
}

document.getElementById('search-bar').oninput = () => renderTools();

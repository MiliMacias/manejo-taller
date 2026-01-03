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

// --- CORE ---
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

// --- CATEGORÍAS ---
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

    if (editingIndex !== null) {
        tools[editingIndex] = toolData;
        editingIndex = null;
        document.getElementById('submit-tool-btn').textContent = "Añadir Herramienta";
    } else {
        tools.push(toolData);
    }
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

    list.innerHTML = tools
        .map((t, i) => ({...t, originalIdx: i}))
        .filter(t => (t.name.toLowerCase().includes(search) || t.location.toLowerCase().includes(search)) && (filterCat === "Todas" || t.category === filterCat))
        .map(t => `
            <div class="tool-card" style="border-left: 5px solid ${t.inUse ? '#e74c3c' : '#2ecc71'}">
                <h4>${t.name}</h4>
                <p><small>${t.category}</small> | 📍 ${t.location}</p>
                <p>👤 ${t.borrowedTo || 'En taller'}</p>
                <div class="flex-row">
                    <button onclick="toggleLoan(${t.originalIdx})">${t.inUse ? 'Devolver' : 'Prestar'}</button>
                    <button onclick="editTool(${t.originalIdx})" class="btn-primary">✏️</button>
                </div>
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

// --- PRESUPUESTOS ---
window.addBudgetItem = () => {
    const desc = document.getElementById('budget-item').value;
    const price = parseFloat(document.getElementById('budget-price').value);
    const type = document.getElementById('item-type').value;
    if(desc && price) {
        budgetItems.push({ desc, price, type });
        calculateTotals(); renderBudget();
    }
};

function calculateTotals() {
    const hRate = parseFloat(document.getElementById('hourly-rate').value) || 0;
    const overhead = (parseFloat(document.getElementById('overhead-percent').value) || 0) / 100;
    let matSum = 0, laborSum = 0;

    budgetItems.forEach(it => {
        if(it.type === 'Material') matSum += (it.price * 1.20);
        else laborSum += (it.price * hRate);
    });
    const subtotal = matSum + laborSum;
    const total = subtotal * (1 + overhead);
    document.getElementById('subtotal-val').textContent = subtotal.toFixed(2);
    document.getElementById('budget-total').textContent = total.toFixed(2);
}

function renderBudget() {
    document.getElementById('budget-body').innerHTML = budgetItems.map((it, i) => `
        <tr><td>${it.type}</td><td>${it.desc}</td><td>$${it.price}</td><td onclick="budgetItems.splice(${i},1);renderBudget();calculateTotals()">❌</td></tr>
    `).join('');
}

window.processAndSaveBudget = () => {
    const total = parseFloat(document.getElementById('budget-total').textContent);
    const client = document.getElementById('client-name').value || "Cliente";
    
    budgetHistory.push({ 
        client, 
        amount: total, 
        date: new Date().toLocaleDateString(), 
        status: 'Pendiente' 
    });

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text(`PRESUPUESTO - ${client}`, 10, 10);
    doc.text(`Total: $${total.toFixed(2)}`, 10, 20);
    doc.save(`Presupuesto_${client}.pdf`);

    budgetItems = []; renderBudget(); sync(); renderHistory();
};

window.updateBudgetStatus = (i) => {
    budgetHistory[i].status = budgetHistory[i].status === 'Pendiente' ? 'Concretado' : 'Pendiente';
    sync(); renderHistory();
};

window.deleteBudget = (i) => {
    if(confirm("¿Eliminar presupuesto?")) {
        budgetHistory.splice(i, 1);
        sync(); renderHistory();
    }
};

function renderHistory() {
    let totalReal = 0;
    document.getElementById('history-body').innerHTML = budgetHistory.map((h, i) => {
        if(h.status === 'Concretado') totalReal += h.amount;
        return `
            <tr>
                <td>${h.date}</td>
                <td>${h.client}</td>
                <td>$${h.amount.toFixed(2)}</td>
                <td><button onclick="updateBudgetStatus(${i})" class="${h.status === 'Pendiente' ? 'btn-warn' : 'btn-success'}">${h.status}</button></td>
                <td><button onclick="deleteBudget(${i})">🗑️</button></td>
            </tr>
        `;
    }).join('');
    document.getElementById('monthly-earnings').textContent = `$${totalReal.toFixed(2)}`;
}

document.getElementById('search-bar').oninput = () => renderTools();

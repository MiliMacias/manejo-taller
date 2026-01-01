<script type="module">
  // 1. IMPORTACIONES (Versión Modular)
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
    appId: "1:1083751146344:web:77395408533a8690ddecdd",
    measurementId: "G-E00FX4MTRE"
  };

  // 3. INICIALIZACIÓN
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getDatabase(app);

  // Variables de Estado
  let tools = [], categories = [], budgetHistory = [], budgetItems = [];

  // --- SEGURIDAD Y LOGIN ---
  window.login = async function() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('auth-error');

    // Limpiar mensaje previo y mostrar que está cargando
    errorDiv.style.display = 'none';
    errorDiv.style.color = "#e67e22"; // Color naranja mientras carga
    errorDiv.innerText = "Verificando credenciales...";
    errorDiv.style.display = 'block';

    try {
        await signInWithEmailAndPassword(auth, email, pass);
        // Si tiene éxito, el onAuthStateChanged se encargará de ocultar el login
    } catch (error) {
        console.error(error); // Lo dejamos en consola solo por si acaso
        errorDiv.style.color = "red";
        
        // Traducción de errores comunes de Firebase
        switch (error.code) {
            case 'auth/invalid-email':
                errorDiv.innerText = "❌ El formato del correo no es válido.";
                break;
            case 'auth/user-not-found':
                errorDiv.innerText = "❌ No existe una cuenta con este correo.";
                break;
            case 'auth/wrong-password':
                errorDiv.innerText = "❌ Contraseña incorrecta.";
                break;
            case 'auth/invalid-credential':
                errorDiv.innerText = "❌ Correo o contraseña incorrectos.";
                break;
            case 'auth/too-many-requests':
                errorDiv.innerText = "❌ Demasiados intentos. Intenta más tarde.";
                break;
            default:
                errorDiv.innerText = "❌ Error: " + error.message;
        }
    }
};


  window.logout = function() { 
    signOut(auth); 
  }

  onAuthStateChanged(auth, (user) => {
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
    const dbRef = ref(db, '/');
    onValue(dbRef, (snapshot) => {
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
    update(ref(db, '/'), { 
        tools: tools, 
        categories: categories, 
        history: budgetHistory 
    });
  }

  // --- CATEGORÍAS ---
  window.renderCategories = function() {
    const select = document.getElementById('tool-category-select');
    const tags = document.getElementById('category-tags');
    if(!select || !tags) return;
    select.innerHTML = ''; tags.innerHTML = '';
    categories.forEach((cat, i) => {
        select.innerHTML += `<option value="${cat}">${cat}</option>`;
        tags.innerHTML += `<div class="category-tag">${cat} <span onclick="deleteCategory(${i})" style="cursor:pointer">×</span></div>`;
    });
  }

  window.addCategory = function() {
    const val = document.getElementById('new-category-name').value.trim();
    if(val) { 
        categories.push(val); 
        syncCloud(); 
        document.getElementById('new-category-name').value = ''; 
    }
  }

  window.deleteCategory = function(i) {
    if(confirm("¿Eliminar categoría?")) { 
        categories.splice(i, 1); 
        syncCloud(); 
    }
  }

  // --- HERRAMIENTAS ---
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
                <span class="status-badge ${tool.inUse ? 'in-use' : 'available'}">
                    ${tool.inUse ? '📍 EN USO' : '✅ DISPONIBLE'}
                </span>
                <h3>${tool.name}</h3>
                <p>Categoría: <strong>${tool.category}</strong></p>
                ${tool.inUse ? `<p>Poseedor: <strong>${tool.borrowedTo}</strong></p>` : ''}
                <div class="flex-row" style="margin-top:15px; display: flex; gap: 10px;">
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

  // Manejo del Formulario
  const toolForm = document.getElementById('tool-form');
  if(toolForm) {
      toolForm.onsubmit = (e) => {
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
  }

  window.toggleLoan = function(i) {
    if(!tools[i].inUse) {
        const p = prompt("¿Quién retira la herramienta?");
        if(p) { tools[i].inUse = true; tools[i].borrowedTo = p; }
    } else {
        tools[i].inUse = false; tools[i].borrowedTo = '';
    }
    syncCloud();
  }

  window.deleteTool = function(i) { 
    if(confirm("¿Borrar herramienta?")) { tools.splice(i,1); syncCloud(); } 
  }

  // --- PRESUPUESTOS ---
  window.addBudgetItem = function() {
    const d = document.getElementById('budget-item'), p = document.getElementById('budget-price');
    if(d.value && p.value) {
        budgetItems.push({ desc: d.value, price: parseFloat(p.value) });
        d.value = ''; p.value = ''; renderBudget();
    }
  }

  window.renderBudget = function() {
    const body = document.getElementById('budget-body');
    let total = 0; body.innerHTML = '';
    budgetItems.forEach((item, i) => {
        total += item.price;
        body.innerHTML += `<tr><td>${item.desc}</td><td>$${item.price.toFixed(2)}</td><td onclick="removeBudgetItem(${i})" style="color:red; cursor:pointer">×</td></tr>`;
    });
    document.getElementById('budget-total').textContent = total.toFixed(2);
  }

  window.removeBudgetItem = function(i) { 
    budgetItems.splice(i, 1); 
    renderBudget(); 
  }

  window.updateEarnings = function() {
    const m = new Date().getMonth(), y = new Date().getFullYear();
    const total = budgetHistory.reduce((acc, h) => {
        const d = new Date(h.date);
        return (d.getMonth() === m && d.getFullYear() === y) ? acc + h.amount : acc;
    }, 0);
    const earnElem = document.getElementById('monthly-earnings');
    if(earnElem) earnElem.textContent = `$${total.toFixed(2)}`;
  }

  window.processAndSaveBudget = async function() {
    const client = document.getElementById('client-name').value || "Cliente General";
    if(budgetItems.length === 0) return alert("El presupuesto está vacío");

    const total = budgetItems.reduce((s, i) => s + i.price, 0);

    // PDF con jsPDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(20); doc.text("PRESUPUESTO DE TRABAJO", 20, 20);
    doc.setFontSize(12); doc.text(`Cliente: ${client}`, 20, 35);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 150, 35);
    let yPos = 50;
    budgetItems.forEach(it => { 
        doc.text(`${it.desc}`, 20, yPos); 
        doc.text(`$${it.price}`, 160, yPos); 
        yPos += 10; 
    });
    doc.line(20, yPos, 190, yPos);
    doc.setFontSize(14); doc.text(`TOTAL: $${total.toFixed(2)}`, 140, yPos + 10);
    doc.save(`Presupuesto_${client}.pdf`);

    // Guardar en Nube
    budgetHistory.push({ amount: total, date: new Date().toISOString() });
    budgetItems = []; 
    renderBudget();
    document.getElementById('client-name').value = '';
    syncCloud();
  }

  // Buscador en tiempo real
  const searchBar = document.getElementById('search-bar');
  if(searchBar) {
      searchBar.oninput = () => renderTools();
  }

</script>
 

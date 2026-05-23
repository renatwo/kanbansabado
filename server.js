const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || 'super-secret-key-for-jwt-do-not-use-in-prod';

app.use(cors());
app.use(express.json());
// Servir arquivos estáticos da pasta /public
app.use(express.static(path.join(__dirname, 'public')));

const USERS_FILE = path.join(__dirname, 'users.json');
const TASKS_FILE = path.join(__dirname, 'tasks.json');
const REVOKED_TOKENS_FILE = path.join(__dirname, 'revoked_tokens.json');

// Helper para criar os arquivos caso não existam
function ensureFileExists(filePath, defaultData) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
  }
}

ensureFileExists(USERS_FILE, []);
ensureFileExists(TASKS_FILE, []);
ensureFileExists(REVOKED_TOKENS_FILE, []);

// Helpers de leitura/escrita
function readJSON(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// -----------------------------------------------------
// ROTAS DE AUTENTICAÇÃO
// -----------------------------------------------------

// Cadastro
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
  }

  const users = readJSON(USERS_FILE);
  if (users.find(u => u.email === email)) {
    return res.status(400).json({ error: 'O email já existe' });
  }

  try {
    // Hash da senha com saltRounds: 10
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      userId: Date.now().toString(),
      name,
      email,
      password: hashedPassword
    };
    users.push(newUser);
    writeJSON(USERS_FILE, users);
    res.status(201).json({ message: 'Usuário registrado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao registrar usuário' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  }

  const users = readJSON(USERS_FILE);
  const user = users.find(u => u.email === email);
  
  if (!user) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  try {
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // JWT válido por 8 horas
    const token = jwt.sign(
      { userId: user.userId, name: user.name, email: user.email },
      SECRET_KEY,
      { expiresIn: '8h' }
    );
    
    res.json({ token, user: { userId: user.userId, name: user.name, email: user.email } });
  } catch (error) {
    res.status(500).json({ error: 'Erro durante o login' });
  }
});

// Logout
app.post('/api/auth/logout', authenticateToken, (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  const revoked = readJSON(REVOKED_TOKENS_FILE);
  if (!revoked.includes(token)) {
    revoked.push(token);
    writeJSON(REVOKED_TOKENS_FILE, revoked);
  }
  res.json({ message: 'Logout realizado com sucesso' });
});

// Middleware de Autenticação
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Formato: Bearer <token>

  if (!token) return res.status(401).json({ error: 'Acesso negado, nenhum token fornecido' });

  const revoked = readJSON(REVOKED_TOKENS_FILE);
  if (revoked.includes(token)) {
    return res.status(401).json({ error: 'Token revogado. Por favor, faça o login novamente.' });
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido ou expirado' });
    req.user = user;
    next();
  });
}

// -----------------------------------------------------
// ROTAS DE TAREFAS (Protegidas)
// -----------------------------------------------------

// Listar Tarefas (calculando isOverdue)
app.get('/api/tasks', authenticateToken, (req, res) => {
  const allTasks = readJSON(TASKS_FILE);
  // Retornar apenas tarefas do usuário autenticado
  const userTasks = allTasks.filter(t => t.userId === req.user.userId);
  
  const now = new Date();
  
  const tasksWithOverdue = userTasks.map(task => {
    let isOverdue = false;
    // Uma tarefa está em atraso se: dueDate existe, dueDate < new Date() e completed === false
    if (task.dueDate && !task.completed) {
      const dueDate = new Date(task.dueDate);
      if (dueDate < now) {
        isOverdue = true;
      }
    }
    return { ...task, isOverdue };
  });

  res.json(tasksWithOverdue);
});

// Criar Tarefa
app.post('/api/tasks', authenticateToken, (req, res) => {
  const { title, description, status, dueDate, priority } = req.body;
  
  if (!title) return res.status(400).json({ error: 'O título é obrigatório' });

  const tasks = readJSON(TASKS_FILE);
  const newTask = {
    id: Date.now().toString(), // id único
    userId: req.user.userId,
    title,
    description: description || '',
    status: status || 'todo',
    dueDate: dueDate || null,
    priority: priority || 'medium',
    completed: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  tasks.push(newTask);
  writeJSON(TASKS_FILE, tasks);
  res.status(201).json(newTask);
});

// Editar Tarefa
app.put('/api/tasks/:id', authenticateToken, (req, res) => {
  const { title, description, status, dueDate, priority } = req.body;
  const tasks = readJSON(TASKS_FILE);
  const taskIndex = tasks.findIndex(t => t.id === req.params.id);

  if (taskIndex === -1) return res.status(404).json({ error: 'Tarefa não encontrada' });
  // Garantir que a tarefa pertence ao usuário autenticado
  if (tasks[taskIndex].userId !== req.user.userId) return res.status(403).json({ error: 'Não autorizado' });

  tasks[taskIndex] = {
    ...tasks[taskIndex],
    title: title !== undefined ? title : tasks[taskIndex].title,
    description: description !== undefined ? description : tasks[taskIndex].description,
    status: status !== undefined ? status : tasks[taskIndex].status,
    dueDate: dueDate !== undefined ? dueDate : tasks[taskIndex].dueDate,
    priority: priority !== undefined ? priority : tasks[taskIndex].priority,
    updatedAt: new Date().toISOString()
  };

  writeJSON(TASKS_FILE, tasks);
  res.json(tasks[taskIndex]);
});

// Excluir Tarefa
app.delete('/api/tasks/:id', authenticateToken, (req, res) => {
  let tasks = readJSON(TASKS_FILE);
  const taskIndex = tasks.findIndex(t => t.id === req.params.id);

  if (taskIndex === -1) return res.status(404).json({ error: 'Tarefa não encontrada' });
  if (tasks[taskIndex].userId !== req.user.userId) return res.status(403).json({ error: 'Não autorizado' });

  tasks = tasks.filter(t => t.id !== req.params.id);
  writeJSON(TASKS_FILE, tasks);
  res.json({ message: 'Tarefa excluída' });
});

// Atualizar Apenas o Status (para Drag & Drop)
app.patch('/api/tasks/:id/status', authenticateToken, (req, res) => {
  const { status } = req.body;
  if (!['todo', 'doing', 'done'].includes(status)) {
    return res.status(400).json({ error: 'Status inválido' });
  }

  const tasks = readJSON(TASKS_FILE);
  const taskIndex = tasks.findIndex(t => t.id === req.params.id);

  if (taskIndex === -1) return res.status(404).json({ error: 'Tarefa não encontrada' });
  if (tasks[taskIndex].userId !== req.user.userId) return res.status(403).json({ error: 'Não autorizado' });

  tasks[taskIndex].status = status;
  tasks[taskIndex].updatedAt = new Date().toISOString();
  
  writeJSON(TASKS_FILE, tasks);
  res.json(tasks[taskIndex]);
});

// Atualizar "completed" (true/false) independente do status
app.patch('/api/tasks/:id/complete', authenticateToken, (req, res) => {
  const tasks = readJSON(TASKS_FILE);
  const taskIndex = tasks.findIndex(t => t.id === req.params.id);

  if (taskIndex === -1) return res.status(404).json({ error: 'Tarefa não encontrada' });
  if (tasks[taskIndex].userId !== req.user.userId) return res.status(403).json({ error: 'Não autorizado' });

  tasks[taskIndex].completed = !tasks[taskIndex].completed;
  tasks[taskIndex].updatedAt = new Date().toISOString();
  
  writeJSON(TASKS_FILE, tasks);
  res.json(tasks[taskIndex]);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

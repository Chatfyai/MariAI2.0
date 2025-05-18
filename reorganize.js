const fs = require('fs');
const path = require('path');

// Função para copiar arquivo
function copyFile(source, target) {
  const targetDir = path.dirname(target);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  fs.copyFileSync(source, target);
  console.log(`Copied: ${source} -> ${target}`);
}

// Função para remover diretório
function removeDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`Removed: ${dir}`);
  }
}

// Arquivos a serem copiados
const filesToCopy = [
  {
    source: 'chat-mari-ai/src/app/layout.tsx',
    target: 'src/app/layout.tsx'
  },
  {
    source: 'src/app/page.tsx',
    target: 'src/app/page.tsx'
  },
  {
    source: 'chat-mari-ai/src/app/globals.css',
    target: 'src/app/globals.css'
  },
  {
    source: 'chat-mari-ai/src/app/favicon.ico',
    target: 'src/app/favicon.ico'
  },
  {
    source: 'chat-mari-ai/package.json',
    target: 'package.json'
  },
  {
    source: 'chat-mari-ai/tsconfig.json',
    target: 'tsconfig.json'
  },
  {
    source: 'chat-mari-ai/tailwind.config.js',
    target: 'tailwind.config.js'
  },
  {
    source: 'chat-mari-ai/postcss.config.js',
    target: 'postcss.config.js'
  }
];

// Copiar arquivos
filesToCopy.forEach(({ source, target }) => {
  if (fs.existsSync(source)) {
    copyFile(source, target);
  } else {
    console.log(`Source file not found: ${source}`);
  }
});

// Remover diretórios antigos
removeDir('chat-mari-ai');

console.log('Reorganização concluída!'); 
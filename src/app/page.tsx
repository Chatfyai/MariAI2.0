'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MagnifyingGlassIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';

interface Message {
  id: number;
  text: string;
  isUser: boolean;
  timestamp: Date;
  isAudio?: boolean;
  isPlaying?: boolean;
  audioUrl?: string;
}

// Adicionar interfaces para o SpeechRecognition
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

// Remover a declaração global e modificar a interface SpeechRecognition
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

const N8N_WEBHOOK_URL = 'https://chatfy.app.n8n.cloud/webhook-test/ebdcc93c-1fa0-4b18-8818-1af0b4db1303';
const N8N_AUDIO_WEBHOOK_URL = 'https://chatfy.app.n8n.cloud/webhook-test/53267980-a99f-47fc-81ea-29bce15f1481';

// Adicionar estilos globais no início do arquivo, após os imports
const styles = {
  pulseAnimation: {
    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
  }
};

// Adicionar keyframes no componente principal, antes do return
const keyframes = `
  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 0.8; }
    50% { transform: scale(1.1); opacity: 1; }
  }
`;

export default function Home() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAudioMode, setIsAudioMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [recognizedText, setRecognizedText] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Efeito para rolar para o final do chat quando novas mensagens chegarem
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Modificar a inicialização do SpeechRecognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognitionAPI) {
          const recognition = new SpeechRecognitionAPI();
          recognition.continuous = false;
          recognition.interimResults = false;
          recognition.lang = 'pt-BR';

          recognition.onresult = (event: any) => {
            const text = event.results[0][0].transcript;
            setRecognizedText(text);
            sendMessageToN8N(text);
          };

          recognition.onerror = (event: any) => {
            console.error('Erro no reconhecimento de voz:', event.error);
            setIsRecording(false);
          };

          recognition.onend = () => {
            setIsRecording(false);
          };

          recognitionRef.current = recognition;
        }
      } catch (error) {
        console.error('Erro ao inicializar reconhecimento de voz:', error);
      }
    }
  }, []);

  // Função para simular reprodução de áudio
  const playAudio = (messageId: number) => {
    // Encontrar a mensagem com o ID correspondente
    const message = messages.find(msg => msg.id === messageId);
    
    if (!message) return;
    
    // Atualizar o estado de reprodução
    setMessages(prev => 
      prev.map(msg => msg.id === messageId ? { ...msg, isPlaying: true } : msg)
    );
    
    // Se a mensagem tem uma URL de áudio, reproduzir o arquivo
    if (message.audioUrl && audioRef.current) {
      audioRef.current.src = message.audioUrl;
      audioRef.current.play().catch(err => {
        console.error("Erro ao reproduzir áudio:", err);
      });
      
      // Quando o áudio terminar, atualizar o estado
      audioRef.current.onended = () => {
        setMessages(prev => 
          prev.map(msg => msg.id === messageId ? { ...msg, isPlaying: false } : msg)
        );
      };
    } else {
      // Sem URL de áudio, simular a duração (5 segundos)
      setTimeout(() => {
        setMessages(prev => 
          prev.map(msg => msg.id === messageId ? { ...msg, isPlaying: false } : msg)
        );
      }, 5000);
    }
  };

  const handleStartChat = (initialMessage?: string) => {
    setIsExiting(true);
    if (initialMessage) {
      const newMessage = {
        id: Date.now(),
        text: initialMessage,
        isUser: true,
        timestamp: new Date(),
        isAudio: isAudioMode
      };
      setMessages([newMessage]);
      // Enviar a mensagem inicial para o n8n
      sendMessageToN8N(initialMessage);
    }
    setTimeout(() => {
      setIsChatOpen(true);
      setIsExiting(false);
    }, 500);
  };

  const sendMessageToN8N = async (message: string) => {
    try {
      setIsLoading(true);
      console.log('Enviando mensagem para n8n:', message);

      // Escolher o webhook correto baseado no modo
      const webhookUrl = isAudioMode ? N8N_AUDIO_WEBHOOK_URL : N8N_WEBHOOK_URL;

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          timestamp: new Date().toISOString(),
          isAudio: isAudioMode,
          inputType: isAudioMode ? 'audio' : 'text',
          messageType: isAudioMode ? 'voice_message' : 'text_message'
        }),
      });

      console.log('Status da resposta:', response.status);
      
      if (!response.ok) {
        throw new Error(`Erro ao enviar mensagem para o n8n: ${response.status}`);
      }

      const data = await response.json();
      console.log('Resposta do n8n:', data);

      // Processamento específico para o formato [{"output":"mensagem"}]
      let responseText = '';
      let audioUrl = '';
      
      // Verificar se a resposta contém um arquivo de áudio
      if (data.audio || data.audioUrl || data.mp3 || data.audioFile) {
        audioUrl = data.audio || data.audioUrl || data.mp3 || data.audioFile;
        responseText = "Resposta em áudio";
        console.log('URL do áudio detectada:', audioUrl);
      } 
      // Verificar formato de resposta com audio aninhado
      else if (data.data && (data.data.audio || data.data.audioUrl || data.data.mp3 || data.data.audioFile)) {
        audioUrl = data.data.audio || data.data.audioUrl || data.data.mp3 || data.data.audioFile;
        responseText = "Resposta em áudio";
        console.log('URL do áudio aninhada detectada:', audioUrl);
      }
      // Caso seja um objeto com informações do arquivo
      else if (data.fileName && data.fileName.includes('.mp3')) {
        responseText = `Resposta em áudio: ${data.fileName}`;
        // Se não houver URL, vamos assumir que o áudio está sendo processado
        console.log('Arquivo de áudio detectado:', data.fileName);
      }
      // Processamento normal para respostas de texto
      else {
        // Caso seja um array
        if (Array.isArray(data)) {
          // Se for um array com objetos que têm o campo output
          if (data.length > 0 && data[0] && data[0].output) {
            responseText = data[0].output;
          } else {
            // Tenta extrair texto diretamente do array
            responseText = data.map(item => 
              typeof item === 'string' ? item : JSON.stringify(item)
            ).join('\n');
          }
        } 
        // Caso seja objeto com formato específico
        else if (typeof data === 'object') {
          if (data.output) {
            responseText = data.output;
          } else if (data.response) {
            responseText = data.response;
          } else if (data.message) {
            responseText = data.message;
          } else if (data.text) {
            responseText = data.text;
          } else if (data.data) {
            if (typeof data.data === 'string') {
              responseText = data.data;
            } else if (Array.isArray(data.data) && data.data.length > 0 && data.data[0].output) {
              responseText = data.data[0].output;
            } else {
              responseText = JSON.stringify(data.data);
            }
          } else {
            responseText = JSON.stringify(data);
          }
        } 
        // Caso seja uma string
        else if (typeof data === 'string') {
          responseText = data;
        } 
        // Fallback
        else {
          responseText = JSON.stringify(data);
        }
      }

      console.log('Texto da resposta processado:', responseText);
      
      // Adicionar a resposta do n8n ao chat
      const aiResponse: Message = {
        id: Date.now(),
        text: responseText || "Desculpe, não consegui processar sua mensagem.",
        isUser: false,
        timestamp: new Date(),
        isAudio: isAudioMode || !!audioUrl,
        isPlaying: isAudioMode || !!audioUrl, // Iniciar reprodução automática
        audioUrl: audioUrl || undefined
      };
      
      console.log('Adicionando mensagem ao chat:', aiResponse);
      setMessages(prev => [...prev, aiResponse]);
      
      // Reproduzir áudio automaticamente se houver URL ou se estiver no modo áudio
      if (audioUrl && audioRef.current) {
        // Esperar um pequeno tempo para garantir que o audioRef está pronto
        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.src = audioUrl;
            audioRef.current.play().catch(err => {
              console.error("Erro ao reproduzir áudio:", err);
              
              // Em caso de erro, simular a reprodução visualmente
              setTimeout(() => {
                setMessages(prev => 
                  prev.map(msg => msg.id === aiResponse.id ? { ...msg, isPlaying: false } : msg)
                );
                setIsLoading(false);
              }, 5000);
            });
            
            // Quando o áudio terminar, atualizar o estado
            audioRef.current.onended = () => {
              setMessages(prev => 
                prev.map(msg => msg.id === aiResponse.id ? { ...msg, isPlaying: false } : msg)
              );
              setIsLoading(false);
            };
          }
        }, 500);
      } else if (isAudioMode) {
        // Simulação visual sem áudio real
        setTimeout(() => {
          setMessages(prev => 
            prev.map(msg => msg.id === aiResponse.id ? { ...msg, isPlaying: false } : msg)
          );
          setIsLoading(false);
        }, 5000);
      } else {
        // Resposta sem áudio, desativar loading imediatamente
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Erro detalhado ao comunicar com n8n:', error);
      // Adicionar mensagem de erro ao chat
      const errorMessage: Message = {
        id: Date.now(),
        text: "Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.",
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsLoading(false);
    } finally {
      // Esse finally serve como segurança apenas
      setTimeout(() => {
        if (isLoading) {
          setIsLoading(false);
        }
      }, 10000); // Timeout de segurança após 10 segundos
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading) return;

    const newMessage: Message = {
      id: Date.now(),
      text: inputMessage,
      isUser: true,
      timestamp: new Date(),
      isAudio: isAudioMode
    };

    setMessages(prev => [...prev, newMessage]);
    setInputMessage('');

    // Enviar mensagem para o n8n
    await sendMessageToN8N(inputMessage);
  };

  const questions = [
    "Onde fica a loja Naturalys?",
    "Qual o método de pagamento aceito na loja Naturalys?",
    "Quais produtos são vendidos na loja Naturalys?",
    "A loja Naturalys oferece entrega?",
    "Quais são os horários de funcionamento da loja Naturalys?",
    "A loja Naturalys tem produtos orgânicos?",
    "A loja Naturalys faz descontos?",
    "A loja Naturalys tem programa de fidelidade?",
    "A loja Naturalys aceita cartões de crédito?",
    "A loja Naturalys tem estacionamento?",
    "A loja Naturalys faz entregas em toda a cidade?",
    "A loja Naturalys tem produtos importados?"
  ];

  // Duplicar as perguntas para criar um efeito contínuo
  const duplicatedQuestions = [...questions, ...questions];

  // Função para iniciar/parar gravação
  const toggleRecording = () => {
    if (!recognitionRef.current) return;

    if (!isRecording) {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (error) {
        console.error('Erro ao iniciar gravação:', error);
      }
    } else {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  // Atualizar a função sendTestMessage
  const sendTestMessage = async () => {
    console.log('=== INÍCIO DO TESTE DE ÁUDIO ===');
    
    if (isLoading) {
      console.log('Bloqueado: já está carregando');
      return;
    }
    
    setIsLoading(true);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    try {
      const payload = {
        message: "Teste de áudio",
        timestamp: new Date().toISOString(),
        isAudio: true,
        inputType: 'audio',
        messageType: 'voice_message',
        sessionId: Date.now().toString(),
        userId: 'test-user',
        platform: 'web',
        test: true
      };

      // Adicionar mensagem do usuário imediatamente
      const userMessage: Message = {
        id: Date.now(),
        text: "Teste de áudio",
        isUser: true,
        timestamp: new Date(),
        isAudio: true
      };
      
      setMessages(prev => [...prev, userMessage]);

      const response = await fetch(N8N_AUDIO_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, audio/mp3, audio/*'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ${response.status}: ${errorText}`);
      }

      // Verificar o tipo de conteúdo da resposta
      const contentType = response.headers.get('content-type');
      console.log('Tipo de conteúdo recebido:', contentType);

      let audioBlob;
      let audioUrl;

      if (contentType?.includes('audio/')) {
        // Se a resposta é um áudio direto
        audioBlob = await response.blob();
        audioUrl = URL.createObjectURL(audioBlob);
      } else {
        // Se a resposta é JSON com dados do áudio
        const data = await response.json();
        console.log('Dados recebidos:', data);

        if (data.data && data.data.binary) {
          // Se o áudio está em formato binário base64
          const binaryData = atob(data.data.binary);
          const bytes = new Uint8Array(binaryData.length);
          for (let i = 0; i < binaryData.length; i++) {
            bytes[i] = binaryData.charCodeAt(i);
          }
          audioBlob = new Blob([bytes], { type: 'audio/mp3' });
          audioUrl = URL.createObjectURL(audioBlob);
        } else if (data.audio || data.audioUrl || data.mp3) {
          // Se o áudio está em URL
          audioUrl = data.audio || data.audioUrl || data.mp3;
        }
      }

      if (!audioUrl) {
        throw new Error('Nenhum áudio recebido na resposta');
      }

      // Criar mensagem da IA com o áudio
      const aiResponse: Message = {
        id: Date.now() + 1,
        text: "Resposta em áudio",
        isUser: false,
        timestamp: new Date(),
        isAudio: true,
        isPlaying: true,
        audioUrl: audioUrl
      };

      // Adicionar mensagem da IA ao chat
      setMessages(prev => [...prev, aiResponse]);

      // Reproduzir o áudio
      if (audioRef.current) {
        try {
          audioRef.current.src = audioUrl;
          await audioRef.current.play();
          
          // Limpar a URL do objeto quando o áudio terminar
          audioRef.current.onended = () => {
            URL.revokeObjectURL(audioUrl);
            setMessages(prev => 
              prev.map(msg => msg.id === aiResponse.id ? { ...msg, isPlaying: false } : msg)
            );
            setIsLoading(false);
          };

          // Em caso de erro na reprodução
          audioRef.current.onerror = (error) => {
            console.error('Erro na reprodução do áudio:', error);
            URL.revokeObjectURL(audioUrl);
            setMessages(prev => 
              prev.map(msg => msg.id === aiResponse.id ? { ...msg, isPlaying: false } : msg)
            );
            setIsLoading(false);
          };
        } catch (error) {
          console.error('Erro ao reproduzir áudio:', error);
          URL.revokeObjectURL(audioUrl);
          setTimeout(() => {
            setMessages(prev => 
              prev.map(msg => msg.id === aiResponse.id ? { ...msg, isPlaying: false } : msg)
            );
            setIsLoading(false);
          }, 5000);
        }
      }
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('Erro no teste de áudio:', error);
      
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: error instanceof Error && error.name === 'AbortError' 
          ? "Tempo limite excedido. Por favor, tente novamente."
          : "Erro ao processar mensagem de teste. Por favor, tente novamente.",
        isUser: false,
        timestamp: new Date()
      }]);
      
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white relative">
      {/* Elemento de áudio oculto para reprodução */}
      <audio ref={audioRef} className="hidden"></audio>
      
      <AnimatePresence>
        {!isChatOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center justify-center min-h-screen p-4"
          >
            <div className="absolute top-6 left-0 right-0 flex justify-center z-10">
              <div className="bg-very-light-green rounded-full p-1 shadow-md border border-light-green">
                <div className="relative flex items-center">
                  <motion.div
                    className="absolute inset-0 z-0"
                    initial={false}
                    animate={{
                      x: isAudioMode ? '100%' : '0%',
                      width: '50%',
                    }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    style={{ height: '85%', top: '7.5%' }}
                  >
                    <div className="w-full h-full bg-primary-green rounded-full" />
                  </motion.div>
                  <button 
                    onClick={() => setIsAudioMode(false)}
                    className={`relative z-10 py-1.5 px-4 rounded-full transition-all duration-300 flex items-center ${!isAudioMode ? 'text-white font-medium' : 'text-dark-green'}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m9 12.75 3 3m0 0 3-3m-3 3v-7.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    Texto
                  </button>
                  <button 
                    onClick={() => setIsAudioMode(true)}
                    className={`relative z-10 py-1.5 px-4 rounded-full transition-all duration-300 flex items-center ${isAudioMode ? 'text-white font-medium' : 'text-dark-green'}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                    </svg>
                    Áudio
                  </button>
                </div>
              </div>
            </div>
            
            <motion.div 
              initial={{ y: -30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -30, opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center mb-10"
            >
              <h1 className="text-5xl font-bold bg-gradient-to-r from-dark-green via-primary-green to-light-green bg-[length:200%_auto] bg-clip-text text-transparent animate-gradient mb-4">
                Oi, sou a Mari
              </h1>
              <p className="text-gray text-lg">
                Seu assistente de IA inteligente para ajudar no seu dia a dia
              </p>
            </motion.div>

            {isAudioMode ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex flex-col items-center justify-center mb-12"
              >
                <style>{keyframes}</style>
                
                <div className="relative w-48 h-48 flex items-center justify-center">
                  {/* Bola principal pulsante */}
                  <motion.div 
                    className="absolute w-32 h-32 bg-gradient-to-br from-primary-green to-dark-green rounded-full shadow-lg"
                    style={{
                      boxShadow: '0 0 20px rgba(76, 175, 80, 0.3)',
                    }}
                    animate={{
                      scale: [1, 1.05, 1],
                      opacity: [0.8, 1, 0.8],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  >
                    {/* Efeito de brilho interno */}
                    <div className="absolute inset-0 rounded-full bg-white opacity-20 blur-sm"></div>
                    
                    {/* Efeito de brilho externo */}
                    <div 
                      className="absolute -inset-2 rounded-full bg-primary-green opacity-20 blur-md"
                      style={{
                        animation: 'pulse 2s ease-in-out infinite',
                      }}
                    ></div>
                  </motion.div>

                  {/* Indicador de status */}
                  {isLoading && (
                    <div className="absolute -bottom-8 text-sm text-gray-600 font-medium">
                      Processando...
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div 
                className="w-full max-w-4xl mb-8 overflow-hidden"
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                {[0, 1, 2].map((rowIndex) => (
                  <motion.div
                    key={rowIndex}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ delay: rowIndex * 0.2 }}
                    className="flex mb-4 relative"
                  >
                    <div 
                      className={`flex animate-slide-row ${rowIndex === 1 ? 'animate-slide-row-reverse' : ''}`}
                      style={{ 
                        animationDuration: `${30 + rowIndex * 5}s`,
                        width: '200%'
                      }}
                    >
                      {duplicatedQuestions.slice(rowIndex * 4, (rowIndex + 1) * 4).map((question, index) => (
                        <motion.button
                          key={index}
                          whileHover={{ scale: 1.05, y: -3 }}
                          className="bg-very-light-green text-dark-green px-6 py-2 rounded-full mx-2 whitespace-nowrap border border-light-green shadow-sm hover:bg-primary-green hover:text-white transition-all flex-shrink-0"
                          onClick={() => handleStartChat(question)}
                        >
                          {question}
                        </motion.button>
                      ))}
                      {duplicatedQuestions.slice(rowIndex * 4, (rowIndex + 1) * 4).map((question, index) => (
                        <motion.button
                          key={`dup-${index}`}
                          whileHover={{ scale: 1.05, y: -3 }}
                          className="bg-very-light-green text-dark-green px-6 py-2 rounded-full mx-2 whitespace-nowrap border border-light-green shadow-sm hover:bg-primary-green hover:text-white transition-all flex-shrink-0"
                          onClick={() => handleStartChat(question)}
                        >
                          {question}
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}

            <motion.div 
              className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-sm"
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <div className="max-w-xl mx-auto">
                <p className="text-gray text-center mb-2 animate-pulse-slow">
                  {isAudioMode ? 'Clique no botão para enviar um áudio' : 'Digite uma pergunta para iniciar a conversa'}
                </p>
                <form onSubmit={handleSendMessage} className="relative">
                  {!isAudioMode ? (
                    <>
                      <input
                        type="text"
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        placeholder="Digite sua pergunta ou tópico para começar..."
                        className="w-full px-6 py-4 rounded-full border-2 border-light-green focus:border-primary-green focus:ring-2 focus:ring-primary-green/20 outline-none shadow-lg"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleStartChat(inputMessage);
                          }
                        }}
                      />
                      <button 
                        type="submit"
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary-green text-white p-2 rounded-full hover:bg-dark-green transition-colors"
                      >
                        <MagnifyingGlassIcon className="w-6 h-6" />
                      </button>
                    </>
                  ) : (
                    <div className="flex justify-center">
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={sendTestMessage}
                        className={`relative w-20 h-20 rounded-full ${
                          isLoading 
                            ? 'bg-gray' 
                            : 'bg-primary-green hover:bg-dark-green'
                        } transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {isLoading && (
                          <>
                            <div className="absolute inset-0 rounded-full bg-primary-green/20 animate-ping" style={{ animationDuration: '1.5s' }}></div>
                            <div className="absolute inset-0 rounded-full bg-primary-green/30 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.3s' }}></div>
                            <div className="absolute inset-0 rounded-full bg-primary-green/10 animate-ping" style={{ animationDuration: '2.5s', animationDelay: '0.6s' }}></div>
                          </>
                        )}
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="white" className="w-8 h-8 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                          </svg>
                      </button>
                    </div>
                  )}
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {isChatOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col h-screen"
        >
          <div className="p-4 bg-white border-b border-light-green flex justify-between items-center">
            <div className="w-1/3"></div>
            <div className="w-1/3 text-center">
              <div className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                isAudioMode ? 'bg-dark-green' : 'bg-primary-green'
              } text-white border ${
                isAudioMode ? 'border-light-green' : 'border-dark-green'
              } shadow-sm items-center`}>
                {isAudioMode ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                    </svg>
                    Modo Áudio
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m9 12.75 3 3m0 0 3-3m-3 3v-7.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    Modo Texto
                  </>
                )}
              </div>
            </div>
            <div className="w-1/3 flex justify-end">
              <h2 className="text-lg font-semibold text-primary-green">
                Mari AI
              </h2>
            </div>
          </div>
          
          {/* Resto do conteúdo do chat */}
          <div className="flex-1 p-4 overflow-y-auto">
                {messages.map((message) => (
              <div
                    key={message.id}
                    className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
                  >
                <div className="max-w-md p-2 rounded-lg bg-very-light-green">
                  {message.text}
                            </div>
                            </div>
            ))}
                        </div>

          {/* Área de input */}
          <div className="p-4 bg-white">
            <form onSubmit={handleSendMessage} className="relative">
              {!isAudioMode ? (
                <>
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Digite sua pergunta ou tópico para começar..."
                    className="w-full px-6 py-4 rounded-full border-2 border-light-green focus:border-primary-green focus:ring-2 focus:ring-primary-green/20 outline-none shadow-lg"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleStartChat(inputMessage);
                      }
                    }}
                  />
                  <button 
                    type="submit"
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary-green text-white p-2 rounded-full hover:bg-dark-green transition-colors"
                  >
                    <MagnifyingGlassIcon className="w-6 h-6" />
                  </button>
                </>
              ) : (
                <div className="flex justify-center">
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={sendTestMessage}
                    className={`relative w-20 h-20 rounded-full ${
                      isLoading 
                        ? 'bg-gray' 
                        : 'bg-primary-green hover:bg-dark-green'
                    } transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isLoading && (
                      <>
                        <div className="absolute inset-0 rounded-full bg-primary-green/20 animate-ping" style={{ animationDuration: '1.5s' }}></div>
                        <div className="absolute inset-0 rounded-full bg-primary-green/30 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.3s' }}></div>
                        <div className="absolute inset-0 rounded-full bg-primary-green/10 animate-ping" style={{ animationDuration: '2.5s', animationDelay: '0.6s' }}></div>
                      </>
                    )}
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="white" className="w-8 h-8 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                      </svg>
                  </button>
                </div>
              )}
            </form>
          </div>
        </motion.div>
      )}
    </main>
  );
} 
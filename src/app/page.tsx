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

const N8N_WEBHOOK_URL = 'https://chatfy.app.n8n.cloud/webhook-test/ebdcc93c-1fa0-4b18-8818-1af0b4db1303';

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

  // Efeito para rolar para o final do chat quando novas mensagens chegarem
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

      const response = await fetch(N8N_WEBHOOK_URL, {
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
    "Como fazer a IA aprender com o passar do tempo?",
    "Quais são as melhores práticas de produtividade?",
    "Como economizar tempo nas tarefas diárias?",
    "Dicas para melhorar o trabalho remoto",
    "Sugestões para organizar minha agenda",
    "Como otimizar meu fluxo de trabalho?",
    "Como escrever e-mails mais eficientes?",
    "Ideias para reuniões mais produtivas",
    "Dicas para melhorar minha concentração",
    "Como gerenciar projetos complexos?",
    "Técnicas de brainstorming eficazes",
    "Como automatizar tarefas repetitivas?",
  ];

  // Duplicar as perguntas para criar um efeito contínuo
  const duplicatedQuestions = [...questions, ...questions];

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
                <div className="text-center mb-8">
                  <p className="text-dark-green font-medium text-lg mb-2">Modo de áudio ativado</p>
                  <p className="text-gray">Clique no botão abaixo e fale sua pergunta</p>
                </div>
                
                <button
                  type="button"
                  disabled={isLoading}
                  className={`p-4 rounded-full ${isLoading ? 'bg-gray animate-pulse' : isRecording ? 'bg-dark-green animate-pulse' : 'bg-primary-green hover:bg-dark-green'} transition-colors text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center relative`}
                  onClick={() => {
                    if (isLoading) return;
                    setIsRecording(!isRecording);
                    // Aqui entraria a lógica para iniciar/parar gravação de áudio
                    if (!isRecording) {
                      // Variável para detectar períodos de silêncio
                      let silenceTimeout: NodeJS.Timeout;
                      let recordingDuration = 0;
                      const checkInterval = 300; // Verificar a cada 300ms
                      
                      // Simular detecção de fala e silêncio
                      const detectSpeech = setInterval(() => {
                        recordingDuration += checkInterval;
                        
                        // Simulação aleatória de detecção de fala (em um cenário real, isso seria baseado em níveis de áudio)
                        const isSpeaking = Math.random() > 0.3 && recordingDuration < 5000;
                        
                        if (isSpeaking) {
                          // Se detectar fala, cancelar o timeout de silêncio anterior
                          clearTimeout(silenceTimeout);
                          
                          // E configurar um novo timeout para verificar o silêncio
                          silenceTimeout = setTimeout(() => {
                            // Se ficar em silêncio por 1.5 segundos, finalizar a gravação
                            setIsRecording(false);
                            clearInterval(detectSpeech);
                            
                            // Iniciar processamento
                            setIsLoading(true);
                            
                            // Simular uma resposta após "processamento de áudio"
                            setTimeout(() => {
                              const newMessage: Message = {
                                id: Date.now(),
                                text: "Você enviou um áudio. Em uma implementação real, este áudio seria processado e transcrito aqui.",
                                isUser: true,
                                timestamp: new Date(),
                                isAudio: true,
                                isPlaying: true
                              };

                              setMessages(prev => [...prev, newMessage]);
                              
                              // Simular término da reprodução do áudio após 3 segundos
                              setTimeout(() => {
                                setMessages(prev => 
                                  prev.map(msg => msg.id === newMessage.id ? { ...msg, isPlaying: false } : msg)
                                );
                                
                                // Enviar para o n8n e processar resposta automaticamente
                                sendMessageToN8N("Demonstração de funcionalidade de áudio");
                              }, 3000);
                            }, 1000);
                          }, 1500); // 1.5 segundos de silêncio para considerar que parou de falar
                        }
                        
                        // Se a gravação durar mais de 10 segundos, encerra automaticamente
                        if (recordingDuration > 10000) {
                          setIsRecording(false);
                          clearInterval(detectSpeech);
                          clearTimeout(silenceTimeout);
                          
                          // Processar o áudio
                          setIsLoading(true);
                          setTimeout(() => {
                            const newMessage: Message = {
                              id: Date.now(),
                              text: "Você enviou um áudio longo. Em uma implementação real, este áudio seria processado e transcrito aqui.",
                              isUser: true,
                              timestamp: new Date(),
                              isAudio: true,
                              isPlaying: true
                            };
                            
                            setMessages(prev => [...prev, newMessage]);
                            
                            // Simular término da reprodução do áudio do usuário
                            setTimeout(() => {
                              setMessages(prev => 
                                prev.map(msg => msg.id === newMessage.id ? { ...msg, isPlaying: false } : msg)
                              );
                              
                              // Enviar para o n8n e processar resposta automaticamente
                              sendMessageToN8N("Demonstração de funcionalidade de áudio longo");
                            }, 3000);
                          }, 1000);
                        }
                      }, checkInterval);
                    }
                  }}
                >
                  {/* Círculos de pulso animados durante a gravação */}
                  {isRecording && (
                    <>
                      <div className="absolute inset-0 rounded-full bg-red-400/20 animate-ping" style={{ animationDuration: '1.5s' }}></div>
                      <div className="absolute inset-0 rounded-full bg-red-400/30 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.3s' }}></div>
                      <div className="absolute inset-0 rounded-full bg-red-400/10 animate-ping" style={{ animationDuration: '2.5s', animationDelay: '0.6s' }}></div>
                    </>
                  )}
                  
                  {/* Botão principal */}
                  <motion.div 
                    className={`w-40 h-40 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${
                      isLoading 
                        ? 'bg-gray-300 cursor-not-allowed' 
                        : isRecording 
                          ? 'bg-red-500' 
                          : 'bg-primary-green hover:bg-dark-green'
                    }`}
                    animate={{
                      scale: isRecording ? [1, 1.05, 1] : 1,
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: isRecording ? Infinity : 0,
                      repeatType: "reverse"
                    }}
                  >
                    {isLoading ? (
                      <div className="flex space-x-2">
                        <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    ) : isRecording ? (
                      <div className="relative">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="white" className="w-14 h-14">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 0 1 7.5 5.25h9a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25h-9a2.25 2.25 0 0 1-2.25-2.25v-9Z" />
                        </svg>
                        
                        {/* Ondas de áudio animadas */}
                        <div className="absolute -right-10 top-1/2 -translate-y-1/2 flex items-end space-x-1">
                          <div className="w-1.5 h-3 bg-white rounded-full animate-sound-wave-1"></div>
                          <div className="w-1.5 h-4 bg-white rounded-full animate-sound-wave-2"></div>
                          <div className="w-1.5 h-5 bg-white rounded-full animate-sound-wave-3"></div>
                        </div>
                        <div className="absolute -left-10 top-1/2 -translate-y-1/2 flex items-end space-x-1">
                          <div className="w-1.5 h-5 bg-white rounded-full animate-sound-wave-3"></div>
                          <div className="w-1.5 h-4 bg-white rounded-full animate-sound-wave-2"></div>
                          <div className="w-1.5 h-3 bg-white rounded-full animate-sound-wave-1"></div>
                        </div>
                      </div>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="white" className="w-14 h-14">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                      </svg>
                    )}
                  </motion.div>
                </button>
                
                <div className="mt-6 text-center">
                  <p className="text-gray text-sm">
                    {isRecording 
                      ? "Gravando... Fale sua pergunta" 
                      : isLoading 
                        ? "Processando sua mensagem..." 
                        : "Pressione para gravar sua voz"
                    }
                  </p>
                  {isRecording && (
                    <p className="text-xs text-primary-green mt-2">O áudio será enviado automaticamente quando você parar de falar</p>
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
                        className={`p-4 rounded-full ${isLoading ? 'bg-gray animate-pulse' : isRecording ? 'bg-dark-green animate-pulse' : 'bg-primary-green hover:bg-dark-green'} transition-colors text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center relative`}
                        onClick={() => {
                          if (isLoading) return;
                          setIsRecording(!isRecording);
                          // Aqui entraria a lógica para iniciar/parar gravação de áudio
                          if (!isRecording) {
                            // Variável para detectar períodos de silêncio
                            let silenceTimeout: NodeJS.Timeout;
                            let recordingDuration = 0;
                            const checkInterval = 300; // Verificar a cada 300ms
                            
                            // Simular detecção de fala e silêncio
                            const detectSpeech = setInterval(() => {
                              recordingDuration += checkInterval;
                              
                              // Simulação aleatória de detecção de fala (em um cenário real, isso seria baseado em níveis de áudio)
                              const isSpeaking = Math.random() > 0.3 && recordingDuration < 5000;
                              
                              if (isSpeaking) {
                                // Se detectar fala, cancelar o timeout de silêncio anterior
                                clearTimeout(silenceTimeout);
                                
                                // E configurar um novo timeout para verificar o silêncio
                                silenceTimeout = setTimeout(() => {
                                  // Se ficar em silêncio por 1.5 segundos, finalizar a gravação
                                  setIsRecording(false);
                                  clearInterval(detectSpeech);
                                  
                                  // Iniciar processamento
                                  setIsLoading(true);
                                  
                                  // Simular uma resposta após "processamento de áudio"
                                  setTimeout(() => {
                                    const newMessage: Message = {
                                      id: Date.now(),
                                      text: "Você enviou um áudio. Em uma implementação real, este áudio seria processado e transcrito aqui.",
                                      isUser: true,
                                      timestamp: new Date(),
                                      isAudio: true,
                                      isPlaying: true
                                    };

                                    setMessages(prev => [...prev, newMessage]);
                                    
                                    // Simular término da reprodução do áudio após 3 segundos
                                    setTimeout(() => {
                                      setMessages(prev => 
                                        prev.map(msg => msg.id === newMessage.id ? { ...msg, isPlaying: false } : msg)
                                      );
                                      
                                      // Enviar para o n8n e processar resposta automaticamente
                                      sendMessageToN8N("Demonstração de funcionalidade de áudio");
                                    }, 3000);
                                  }, 1000);
                                }, 1500); // 1.5 segundos de silêncio para considerar que parou de falar
                              }
                              
                              // Se a gravação durar mais de 10 segundos, encerra automaticamente
                              if (recordingDuration > 10000) {
                                setIsRecording(false);
                                clearInterval(detectSpeech);
                                clearTimeout(silenceTimeout);
                                
                                // Processar o áudio
                                setIsLoading(true);
                                setTimeout(() => {
                                  const newMessage: Message = {
                                    id: Date.now(),
                                    text: "Você enviou um áudio longo. Em uma implementação real, este áudio seria processado e transcrito aqui.",
                                    isUser: true,
                                    timestamp: new Date(),
                                    isAudio: true,
                                    isPlaying: true
                                  };
                                  
                                  setMessages(prev => [...prev, newMessage]);
                                  
                                  // Simular término da reprodução do áudio do usuário
                                  setTimeout(() => {
                                    setMessages(prev => 
                                      prev.map(msg => msg.id === newMessage.id ? { ...msg, isPlaying: false } : msg)
                                    );
                                    
                                    // Enviar para o n8n e processar resposta automaticamente
                                    sendMessageToN8N("Demonstração de funcionalidade de áudio longo");
                                  }, 3000);
                                }, 1000);
                              }
                            }, checkInterval);
                          }
                        }}
                      >
                        {isRecording ? (
                          <>
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping"></span>
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 0 1 7.5 5.25h9a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25h-9a2.25 2.25 0 0 1-2.25-2.25v-9Z" />
                            </svg>
                          </>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                          </svg>
                        )}
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
              <div className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${isAudioMode ? 'bg-dark-green' : 'bg-primary-green'} text-white border ${isAudioMode ? 'border-light-green' : 'border-dark-green'} shadow-sm items-center`}>
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
          
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="max-w-2xl mx-auto space-y-4">
              {isAudioMode && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-very-light-green p-3 rounded-lg text-dark-green mb-4 text-center text-sm"
                >
                  <div className="flex items-center justify-center mb-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                    </svg>
                    <span className="font-medium">Modo de áudio ativado</span>
                  </div>
                  <p>As respostas serão automaticamente reproduzidas como áudio.</p>
                </motion.div>
              )}
              <AnimatePresence>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                        message.isUser
                          ? 'bg-primary-green text-white rounded-br-none'
                          : 'bg-very-light-green text-dark-green rounded-bl-none'
                      }`}
                    >
                      {message.isAudio && (
                        <div className="flex items-center mb-2 text-xs">
                          {message.isPlaying ? (
                            <div className="flex items-center">
                              <div className="w-3 h-3 bg-current rounded-full animate-pulse mr-1"></div>
                              <span>{message.isUser ? "Enviando áudio..." : "Reproduzindo áudio..."}</span>
                              {message.audioUrl && (
                                <button 
                                  onClick={() => {
                                    // Parar o áudio
                                    if (audioRef.current) {
                                      audioRef.current.pause();
                                      audioRef.current.currentTime = 0;
                                    }
                                    setMessages(prev => 
                                      prev.map(msg => msg.id === message.id ? { ...msg, isPlaying: false } : msg)
                                    );
                                  }}
                                  className="ml-2 p-1 rounded-full hover:bg-white/20 transition-colors"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          ) : (
                            <div 
                              className="flex items-center cursor-pointer hover:opacity-80 transition-opacity" 
                              onClick={() => playAudio(message.id)}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3 mr-1">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                              </svg>
                              <span>
                                {message.audioUrl 
                                  ? (message.isUser ? "Ouvir seu áudio" : "Ouvir resposta") 
                                  : (message.isUser ? "Áudio enviado" : "Resposta por áudio")
                                }
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {message.isAudio && message.isPlaying && !message.isUser && (
                        <div className="flex justify-center my-2 h-16 bg-dark-green/5 rounded-md p-2">
                          <motion.div 
                            className="flex items-end space-x-1"
                            animate={{ opacity: [0.8, 1, 0.8] }}
                            transition={{ 
                              duration: 2, 
                              repeat: Infinity,
                              repeatType: "reverse"
                            }}
                          >
                            {/* Maior número de barras para uma visualização mais rica */}
                            {Array.from({ length: 16 }).map((_, index) => (
                              <motion.div
                                key={index}
                                className="w-1 bg-dark-green rounded-full"
                                animate={{ 
                                  height: [`${0.3 + Math.random() * 0.7}rem`, `${0.3 + Math.random() * 1.4}rem`, `${0.3 + Math.random() * 0.7}rem`] 
                                }}
                                transition={{ 
                                  duration: 1 + Math.random(), 
                                  repeat: Infinity,
                                  repeatType: "reverse",
                                  ease: "easeInOut"
                                }}
                              />
                            ))}
                          </motion.div>
                        </div>
                      )}

                      {message.audioUrl && !message.isPlaying && (
                        <div className="mt-2">
                          <audio controls className="audio-player w-full max-w-[240px]" src={message.audioUrl}></audio>
                        </div>
                      )}

                      <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
                      <span className="text-xs opacity-70 mt-1 block">
                        {message.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                  </motion.div>
                ))}
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-start"
                  >
                    <div className="bg-very-light-green text-dark-green rounded-2xl rounded-bl-none px-4 py-2">
                      <div className="flex space-x-2">
                        <div className="w-2 h-2 bg-dark-green rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-dark-green rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-dark-green rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Elemento para referência de rolagem automática */}
              <div ref={chatEndRef}></div>
            </div>
          </div>

          <div className="p-4 bg-white">
            <form onSubmit={handleSendMessage} className="max-w-2xl mx-auto relative">
              {!isAudioMode ? (
                <>
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder={isLoading ? "Aguarde a resposta..." : "Digite sua mensagem..."}
                    disabled={isLoading}
                    className="w-full px-6 py-4 rounded-full border-2 border-light-green focus:border-primary-green focus:ring-2 focus:ring-primary-green/20 outline-none shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <button 
                    type="submit"
                    disabled={isLoading}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary-green text-white p-2 rounded-full hover:bg-dark-green transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <PaperAirplaneIcon className="w-6 h-6" />
                  </button>
                </>
              ) : (
                <div className="w-full flex justify-center">
                  <button
                    type="button"
                    disabled={isLoading}
                    className={`p-4 rounded-full ${isLoading ? 'bg-gray animate-pulse' : isRecording ? 'bg-dark-green animate-pulse' : 'bg-primary-green hover:bg-dark-green'} transition-colors text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center relative`}
                    onClick={() => {
                      if (isLoading) return;
                      setIsRecording(!isRecording);
                      // Aqui entraria a lógica para iniciar/parar gravação de áudio
                      if (!isRecording) {
                        // Variável para detectar períodos de silêncio
                        let silenceTimeout: NodeJS.Timeout;
                        let recordingDuration = 0;
                        const checkInterval = 300; // Verificar a cada 300ms
                        
                        // Simular detecção de fala e silêncio
                        const detectSpeech = setInterval(() => {
                          recordingDuration += checkInterval;
                          
                          // Simulação aleatória de detecção de fala (em um cenário real, isso seria baseado em níveis de áudio)
                          const isSpeaking = Math.random() > 0.3 && recordingDuration < 5000;
                          
                          if (isSpeaking) {
                            // Se detectar fala, cancelar o timeout de silêncio anterior
                            clearTimeout(silenceTimeout);
                            
                            // E configurar um novo timeout para verificar o silêncio
                            silenceTimeout = setTimeout(() => {
                              // Se ficar em silêncio por 1.5 segundos, finalizar a gravação
                              setIsRecording(false);
                              clearInterval(detectSpeech);
                              
                              // Iniciar processamento
                              setIsLoading(true);
                              
                              // Simular uma resposta após "processamento de áudio"
                              setTimeout(() => {
                                const newMessage: Message = {
                                  id: Date.now(),
                                  text: "Você enviou um áudio. Em uma implementação real, este áudio seria processado e transcrito aqui.",
                                  isUser: true,
                                  timestamp: new Date(),
                                  isAudio: true,
                                  isPlaying: true
                                };

                                setMessages(prev => [...prev, newMessage]);
                                
                                // Simular término da reprodução do áudio após 3 segundos
                                setTimeout(() => {
                                  setMessages(prev => 
                                    prev.map(msg => msg.id === newMessage.id ? { ...msg, isPlaying: false } : msg)
                                  );
                                  
                                  // Enviar para o n8n e processar resposta automaticamente
                                  sendMessageToN8N("Demonstração de funcionalidade de áudio");
                                }, 3000);
                              }, 1000);
                            }, 1500); // 1.5 segundos de silêncio para considerar que parou de falar
                          }
                          
                          // Se a gravação durar mais de 10 segundos, encerra automaticamente
                          if (recordingDuration > 10000) {
                            setIsRecording(false);
                            clearInterval(detectSpeech);
                            clearTimeout(silenceTimeout);
                            
                            // Processar o áudio
                            setIsLoading(true);
                            setTimeout(() => {
                              const newMessage: Message = {
                                id: Date.now(),
                                text: "Você enviou um áudio longo. Em uma implementação real, este áudio seria processado e transcrito aqui.",
                                isUser: true,
                                timestamp: new Date(),
                                isAudio: true,
                                isPlaying: true
                              };
                              
                              setMessages(prev => [...prev, newMessage]);
                              
                              // Simular término da reprodução do áudio do usuário
                              setTimeout(() => {
                                setMessages(prev => 
                                  prev.map(msg => msg.id === newMessage.id ? { ...msg, isPlaying: false } : msg)
                                );
                                
                                // Enviar para o n8n e processar resposta automaticamente
                                sendMessageToN8N("Demonstração de funcionalidade de áudio longo");
                              }, 3000);
                            }, 1000);
                          }
                        }, checkInterval);
                      }
                    }}
                  >
                    {isRecording ? (
                      <>
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping"></span>
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 0 1 7.5 5.25h9a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25h-9a2.25 2.25 0 0 1-2.25-2.25v-9Z" />
                        </svg>
                      </>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                      </svg>
                    )}
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
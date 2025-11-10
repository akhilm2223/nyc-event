import { useState, useEffect, useRef, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, useGLTF, Center } from '@react-three/drei'

// Preload the model
useGLTF.preload('/textured.glb')

// Small 3D Model Component for Header (same size as emoji)
function HeaderModel({ url }) {
  try {
    const gltf = useGLTF(url || '/textured.glb')
    const scene = gltf?.scene
    
    if (!scene) {
      console.error('HeaderModel: Scene not found')
      return (
        <mesh>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshStandardMaterial color="#000000" />
        </mesh>
      )
    }
    
    // Clone scene to avoid issues
    const clonedScene = scene.clone()
    
    // Ensure model is visible
    clonedScene.traverse((child) => {
      if (child.isMesh) {
        child.visible = true
        child.material = child.material.clone()
        if (child.material) {
          child.material.needsUpdate = true
        }
      }
    })
    
    return (
      <Center>
        <primitive object={clonedScene} scale={0.4} />
      </Center>
    )
  } catch (error) {
    console.error('HeaderModel error:', error)
    return (
      <mesh>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color="#000000" />
      </mesh>
    )
  }
}

// 3D Model Component
function Model3D({ url }) {
  try {
    const { scene } = useGLTF(url || '/textured.glb')
    
    if (!scene) {
      console.error('Model3D: Scene not found in GLB file')
      return (
        <mesh>
          <boxGeometry args={[2, 2, 2]} />
          <meshStandardMaterial color="#6366f1" />
        </mesh>
      )
    }

    // Clone and prepare the scene
    const clonedScene = scene.clone()
    
    // Make sure all meshes are visible and have materials
    clonedScene.traverse((child) => {
      if (child.isMesh) {
        child.visible = true
        child.castShadow = true
        child.receiveShadow = true
        if (child.material) {
          child.material.needsUpdate = true
        }
      }
    })

    console.log('Model3D: Successfully loaded', url)
    
    return (
      <Center>
        <primitive object={clonedScene} scale={2.16} />
      </Center>
    )
  } catch (error) {
    console.error('Model3D error:', error)
    // Fallback: Show a simple rotating cube if model fails to load
    return (
      <mesh>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color="#6366f1" />
      </mesh>
    )
  }
}

// Fallback component when no GLB file is available
function FallbackModel() {
  return (
    <mesh>
      <torusGeometry args={[1, 0.4, 16, 100]} />
      <meshStandardMaterial color="#6366f1" />
    </mesh>
  )
}

export default function Chat() {
  const [messages, setMessages] = useState([]) // Start with empty messages
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [hasStartedChat, setHasStartedChat] = useState(false) // Track if chat has started
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!input.trim()) return

    // Hide 3D model on first message
    if (!hasStartedChat) {
      setHasStartedChat(true)
    }

    const userMsg = { sender: 'user', text: input }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsTyping(true)

    try {
      // Use IP address for mobile, localhost for desktop
      const apiUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:3000/api/chat'
        : `http://${window.location.hostname}:3000/api/chat`
      
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: input,
          sessionId: sessionId 
        })
      })

      const data = await res.json()
      setIsTyping(false)
      
      setMessages(prev => [...prev, { 
        sender: 'ai', 
        text: data.reply || "I found some events for you!",
        eventbriteEvents: data.eventbriteEvents || [],
        dynamicEvents: data.dynamicEvents || [] // Include platform info
      }])
    } catch (error) {
      setIsTyping(false)
      setMessages(prev => [...prev, { 
        sender: 'ai', 
        text: "Sorry, can't connect right now. Make sure the server is running! 🔧" 
      }])
    }
  }

  const handleSuggestionClick = (text) => {
    setInput(text)
    // Auto-focus the input after setting text
    setTimeout(() => {
      document.querySelector('input')?.focus()
    }, 0)
  }

  // Parse message text and extract events, make URLs clickable
  const parseMessageWithLinks = (text) => {
    if (!text) return text
    
    // URL regex pattern
    const urlRegex = /(https?:\/\/[^\s]+)/g
    const parts = text.split(urlRegex)
    
    return parts.map((part, index) => {
      if (urlRegex.test(part)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white underline hover:text-white/80 transition break-all"
          >
            {part}
          </a>
        )
      }
      return <span key={index}>{part}</span>
    })
  }

  // Get platform badge color and icon
  const getPlatformStyle = (platform) => {
    const styles = {
      'Meetup': { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', icon: '👥' },
      'Luma': { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30', icon: '✨' },
      'GoodRec': { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', icon: '⚽' },
      'Eventbrite': { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30', icon: '🎟️' },
      'Perplexity': { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', icon: '🔍' },
      'Dice.fm': { bg: 'bg-pink-500/20', text: 'text-pink-400', border: 'border-pink-500/30', icon: '🎵' },
      'Resident Advisor': { bg: 'bg-indigo-500/20', text: 'text-indigo-400', border: 'border-indigo-500/30', icon: '🎧' },
      'Web': { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30', icon: '🌐' }
    }
    return styles[platform] || styles['Web']
  }

  // Extract event information from text
  const extractEvents = (text) => {
    if (!text) return []
    
    const events = []
    const lines = text.split('\n')
    let currentEvent = null
    
    lines.forEach((line, index) => {
      const trimmed = line.trim()
      
      // Skip empty lines and intro text
      if (!trimmed || trimmed.length < 3) return
      
      // Detect event name - usually a bold line or title without emojis
      if (trimmed && !trimmed.match(/^[🕓📍💰💡🔗🎵🎤🌃🍝💻🧠🧩🎯⚙️🗽]/) && !trimmed.startsWith('http') && !trimmed.toLowerCase().startsWith('platform:') && !trimmed.toLowerCase().startsWith('source:')) {
        // Check if next lines have event details (emojis)
        const nextLines = lines.slice(index + 1, index + 7).join('\n')
        if (nextLines.includes('🕓') || nextLines.includes('📍') || nextLines.includes('💰')) {
          if (currentEvent) events.push(currentEvent)
          currentEvent = { name: trimmed.replace(/^[•\-\*]\s*/, '').replace(/^[0-9]+\.\s*/, ''), details: {} }
        }
      }
      
      if (currentEvent) {
        if (trimmed.includes('🕓')) {
          currentEvent.details.time = trimmed.replace(/🕓\s*/, '').trim()
        } else if (trimmed.includes('📍')) {
          currentEvent.details.location = trimmed.replace(/📍\s*/, '').trim()
        } else if (trimmed.includes('💰')) {
          currentEvent.details.price = trimmed.replace(/💰\s*/, '').trim()
        } else if (trimmed.includes('💡')) {
          currentEvent.details.description = trimmed.replace(/💡\s*/, '').trim()
        } else if (trimmed.toLowerCase().startsWith('platform:')) {
          // Extract platform name (e.g., "Platform: Meetup" or "Platform: Luma")
          currentEvent.details.platform = trimmed.replace(/platform:\s*/i, '').trim()
        } else if (trimmed.toLowerCase().startsWith('source:')) {
          // Extract source info (e.g., "Source: Luma (Web Search)" or "Source: Meetup (Scraped)")
          currentEvent.details.source = trimmed.replace(/source:\s*/i, '').trim()
        } else if (trimmed.match(/https?:\/\/[^\s\)]+/)) {
          const urlMatch = trimmed.match(/https?:\/\/[^\s\)]+/)
          if (urlMatch) {
            currentEvent.details.link = urlMatch[0]
            // Try to detect platform from URL if not already set
            if (!currentEvent.details.platform) {
              const url = urlMatch[0].toLowerCase()
              if (url.includes('meetup.com')) currentEvent.details.platform = 'Meetup'
              else if (url.includes('lu.ma') || url.includes('luma.com')) currentEvent.details.platform = 'Luma'
              else if (url.includes('goodrec.com')) currentEvent.details.platform = 'GoodRec'
              else if (url.includes('eventbrite')) currentEvent.details.platform = 'Eventbrite'
              else currentEvent.details.platform = 'Web'
            }
            events.push(currentEvent)
            currentEvent = null
          }
        }
      }
    })
    
    if (currentEvent) events.push(currentEvent)
    return events
  }

  return (
    <div className="bg-black text-white flex flex-col h-dvh font-sans overflow-hidden w-full max-w-full">
      {/* Minimal Header - Fixed at top */}
      <div className="px-4 sm:px-6 py-4 sm:py-5 shrink-0 backdrop-blur-sm bg-black/50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <div className="flex flex-col">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
                NYC Event AI
              </h1>
              <p className="text-xs sm:text-sm text-white/50 font-medium">Real-time events</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center space-x-1 text-xs text-white/30">
            <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-pulse"></div>
            <span>Online</span>
          </div>
        </div>
      </div>

      {/* Messages Area - Flexible, scrollable */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-4 sm:py-8 min-h-0 w-full">
        <div className="max-w-4xl mx-auto h-full w-full">
          
          {/* 3D Model - Show only before chat starts */}
          {!hasStartedChat && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] py-4 sm:py-8">
              {/* 3D Canvas - Responsive sizing */}
              <div className="w-full max-w-[90vw] sm:max-w-lg md:max-w-xl lg:max-w-2xl h-[300px] sm:h-[400px] md:h-[450px] lg:h-[500px] mb-6 sm:mb-8">
                <Canvas 
                  camera={{ position: [0, 0, 5], fov: 50 }}
                  gl={{ 
                    antialias: false, // Disable for mobile performance
                    powerPreference: "high-performance",
                    failIfMajorPerformanceCaveat: false,
                    preserveDrawingBuffer: false // Better for mobile
                  }}
                  dpr={[1, 1.5]} // Lower pixel ratio for mobile
                  onCreated={({ gl }) => {
                    // Check if WebGL is working
                    if (!gl) {
                      console.error('WebGL not available')
                    }
                  }}
                >
                  <ambientLight intensity={1.2} />
                  <directionalLight position={[5, 5, 5]} intensity={1.5} />
                  <directionalLight position={[-5, -5, -5]} intensity={0.8} />
                  <spotLight position={[10, 10, 10]} angle={0.3} penumbra={1} intensity={1.0} />
                  <pointLight position={[-10, -10, -10]} intensity={0.5} />
                  <Suspense fallback={<FallbackModel />}>
                    <Model3D url="/textured.glb" />
                  </Suspense>
                  <OrbitControls 
                    enableZoom={false} 
                    autoRotate 
                    autoRotateSpeed={1.5}
                    minPolarAngle={Math.PI / 3}
                    maxPolarAngle={Math.PI / 1.5}
                    enableDamping={false}
                  />
                </Canvas>
              </div>

              {/* Welcome Text - Below 3D model with proper spacing */}
              <div className="text-center space-y-2 sm:space-y-3 px-4 w-full max-w-2xl">
                <div className="inline-block">
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight mb-1">
                    NYC Event AI
                  </h2>
                  <div className="h-0.5 bg-gradient-to-r from-transparent via-white to-transparent opacity-30"></div>
                </div>
                <p className="text-white/70 text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
                  Your personal guide to what's happening in the city right now
                </p>
                {/* Suggestion Buttons */}
                <div className="flex flex-wrap gap-1.5 justify-center mt-4">
                  <button 
                    onClick={() => handleSuggestionClick('Find concerts tonight in NYC with ticket links')}
                    className="text-xs px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 transition text-white/50 hover:text-white"
                  >
                    Concerts
                  </button>
                  <button 
                    onClick={() => handleSuggestionClick('Find tech meetups and networking events on Meetup.com this week')}
                    className="text-xs px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 transition text-white/50 hover:text-white"
                  >
                    Meetup events
                  </button>
                  <button 
                    onClick={() => handleSuggestionClick('Find pickup football or soccer games today in NYC')}
                    className="text-xs px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 transition text-white/50 hover:text-white"
                  >
                    Play football
                  </button>
                  <button 
                    onClick={() => handleSuggestionClick('Best clubs and nightlife tonight in NYC with event links')}
                    className="text-xs px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 transition text-white/50 hover:text-white"
                  >
                    Clubs
                  </button>
                </div>
              </div>
            </div>
          )}

              {/* Messages */}
              {messages.length > 0 && (
                <div className="space-y-6">
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`${msg.sender === 'user' ? 'max-w-[80%]' : 'w-full'} ${
                        msg.sender === 'user' 
                          ? 'bg-white text-black' 
                          : 'bg-white/5 border border-white/10'
                      } px-5 py-4 rounded-2xl`}>
                    {/* User message - simple display */}
                    {msg.sender === 'user' && (
                      <div className="text-[15px] leading-relaxed">
                        {msg.text}
                      </div>
                    )}

                    {/* AI message with header */}
                    {msg.sender === 'ai' && (
                      <>
                        <div className="flex items-center space-x-2 mb-3 pb-3 border-b border-white/10">
                          <div className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center">
                            <span className="text-sm">✨</span>
                          </div>
                          <span className="text-xs font-medium text-white/60">Event AI</span>
                        </div>
                        
                        {/* Event Cards - Extract and display events nicely first */}
                        {(() => {
                          const events = extractEvents(msg.text)
                          if (events.length > 0) {
                            // Show ONLY event cards, not the raw text (avoid duplication)
                            return (
                              <>
                                {/* Intro text if any (before events) */}
                                {msg.text.split('\n')[0].length < 100 && !msg.text.split('\n')[0].includes('🕓') && (
                                  <div className="text-[15px] leading-relaxed mb-4 text-white/90">
                                    {msg.text.split('\n')[0]}
                                  </div>
                                )}
                                
                                <div className="space-y-4">
                                  {events.map((event, idx) => {
                                    const platformStyle = event.details.platform ? getPlatformStyle(event.details.platform) : null
                                    const displaySource = event.details.source || event.details.platform
                                    return (
                                      <div key={idx} className="bg-black/40 border border-white/20 rounded-2xl p-5 space-y-3 shadow-lg hover:border-white/30 transition">
                                        {/* Event header with platform badge */}
                                        <div className="flex items-start justify-between gap-3">
                                          <h4 className="font-bold text-white text-lg leading-tight flex-1">{event.name}</h4>
                                          {platformStyle && (
                                            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${platformStyle.bg} ${platformStyle.text} ${platformStyle.border} border shrink-0`}>
                                              <span>{platformStyle.icon}</span>
                                              <span>{displaySource}</span>
                                            </span>
                                          )}
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                        {event.details.time && (
                                          <div className="flex items-start space-x-3">
                                            <span className="text-lg mt-0.5">🕓</span>
                                            <div>
                                              <div className="text-white/60 text-xs uppercase tracking-wide">Date & Time</div>
                                              <div className="text-white font-medium">{event.details.time}</div>
                                            </div>
                                          </div>
                                        )}
                                        {event.details.location && (
                                          <div className="flex items-start space-x-3">
                                            <span className="text-lg mt-0.5">📍</span>
                                            <div>
                                              <div className="text-white/60 text-xs uppercase tracking-wide">Location</div>
                                              <div className="text-white">{event.details.location}</div>
                                            </div>
                                          </div>
                                        )}
                                        {event.details.price && (
                                          <div className="flex items-start space-x-3">
                                            <span className="text-lg mt-0.5">💰</span>
                                            <div>
                                              <div className="text-white/60 text-xs uppercase tracking-wide">Price</div>
                                              <div className={event.details.price.toLowerCase().includes('free') 
                                                ? 'text-green-400 font-bold text-base' 
                                                : 'text-white font-medium'}>
                                                {event.details.price}
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                      {event.details.description && (
                                        <div className="flex items-start space-x-3 pt-1 border-t border-white/10">
                                          <span className="text-lg mt-2">💡</span>
                                          <div className="text-white/80 leading-relaxed pt-2">{event.details.description}</div>
                                        </div>
                                      )}
                                      {event.details.link && event.details.link !== 'Not Available' && (
                                        <a
                                          href={event.details.link}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center space-x-2 mt-3 px-6 py-3 bg-white text-black rounded-xl hover:bg-white/90 transition font-semibold text-sm shadow-md hover:shadow-lg"
                                        >
                                          <span>Get Tickets</span>
                                          <span>→</span>
                                        </a>
                                      )}
                                    </div>
                                    )
                                  })}
                                </div>
                              </>
                            )
                          }
                          // If no events extracted, show regular text
                          return (
                            <div className="text-[15px] leading-relaxed whitespace-pre-wrap">
                              {parseMessageWithLinks(msg.text)}
                            </div>
                          )
                        })()}
                      </>
                    )}
     

                  </div>
                </div>
              ))}

              {/* Typing Indicator */}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white/5 border border-white/10 px-5 py-4 rounded-2xl">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                      <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Input Area - Fixed at bottom */}
      <div className="px-4 sm:px-6 pt-4 pb-6 sm:pt-6 shrink-0" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
        <div className="max-w-3xl mx-auto">
          <form onSubmit={sendMessage} className="relative">
            <input
              className="w-full bg-white/5 text-white pl-5 pr-20 py-3 rounded-full outline-none border border-white/10 focus:border-white/30 transition placeholder-white/40 text-sm"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about events in NYC..."
              disabled={isTyping}
              autoFocus
            />
            <button
              type="submit"
              disabled={isTyping || !input.trim()}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-white text-black px-5 py-1.5 rounded-full font-medium hover:bg-white/90 transition disabled:opacity-30 disabled:cursor-not-allowed text-sm"
            >
              →
            </button>
            </form>
        </div>
      </div>
    </div>
  )
}

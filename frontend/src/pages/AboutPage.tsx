import React from 'react';
import { motion } from 'framer-motion';
import { 
  Info, 
  Github, 
  ExternalLink,
  Server,
  Database,
  Brain,
  Zap,
  Shield,
  Code
} from 'lucide-react';

const techStack = [
  { name: 'React 18', desc: 'UI Framework', icon: <Code size={18} /> },
  { name: 'TypeScript', desc: 'Type Safety', icon: <Shield size={18} /> },
  { name: 'Vite', desc: 'Build Tool', icon: <Zap size={18} /> },
  { name: 'Socket.IO', desc: 'Real-time Data', icon: <Server size={18} /> },
  { name: 'TimescaleDB', desc: 'Time-series Storage', icon: <Database size={18} /> },
  { name: 'Python ML', desc: 'AI Predictions', icon: <Brain size={18} /> },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

/**
 * About Page - Product story, technology stack, and architecture overview
 */
export const AboutPage: React.FC = () => {
  return (
    <motion.div
      className="min-h-screen p-6 space-y-8"
      style={{ backgroundColor: 'var(--bg-0)' }}
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Hero Section */}
      <motion.section 
        className="text-center py-12"
        variants={itemVariants}
      >
        <motion.div
          className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6"
          style={{ 
            backgroundColor: 'var(--surface-1)',
            border: '1px solid var(--border-default)'
          }}
          whileHover={{ scale: 1.05 }}
        >
          <Brain size={40} style={{ color: 'var(--color-primary)' }} />
        </motion.div>
        <h1 className="text-4xl font-bold mb-4" style={{ color: 'var(--text-1)' }}>
          Roneira AI HIFI
        </h1>
        <p className="text-xl max-w-2xl mx-auto" style={{ color: 'var(--text-2)' }}>
          High-Fidelity Financial Intelligence Platform powered by Machine Learning
        </p>
        <div className="flex items-center justify-center gap-4 mt-6">
          <a
            href="https://github.com/roneira/ai-hifi"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-colors"
            style={{ 
              backgroundColor: 'var(--surface-1)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-1)'
            }}
          >
            <Github size={18} />
            View on GitHub
          </a>
          <span className="text-sm" style={{ color: 'var(--text-3)' }}>
            v1.0.0
          </span>
        </div>
      </motion.section>

      {/* Product Story */}
      <motion.section variants={itemVariants}>
        <div 
          className="p-8 rounded-2xl max-w-4xl mx-auto"
          style={{ 
            backgroundColor: 'var(--surface-1)',
            border: '1px solid var(--border-default)'
          }}
        >
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-3" style={{ color: 'var(--text-1)' }}>
            <Info size={24} />
            Our Mission
          </h2>
          <div className="space-y-4 text-base" style={{ color: 'var(--text-2)', lineHeight: 1.8 }}>
            <p>
              Roneira AI HIFI was built to democratize access to sophisticated financial analysis tools 
              that were previously only available to institutional investors. We combine cutting-edge 
              machine learning with intuitive design to help individual investors make data-driven decisions.
            </p>
            <p>
              Our platform features real-time market data streaming, AI-powered price predictions using 
              our proprietary PDM (Price-Volume Derivatives Momentum) strategy, and comprehensive portfolio 
              management tools—all wrapped in a beautiful, responsive interface.
            </p>
            <p>
              Built by engineers who believe that powerful financial tools should be accessible to everyone, 
              not just Wall Street.
            </p>
          </div>
        </div>
      </motion.section>

      {/* Technology Stack */}
      <motion.section variants={itemVariants}>
        <h2 className="text-xl font-bold mb-6 text-center" style={{ color: 'var(--text-1)' }}>
          Technology Stack
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 max-w-4xl mx-auto">
          {techStack.map((tech) => (
            <motion.div
              key={tech.name}
              className="p-4 rounded-xl text-center"
              style={{ 
                backgroundColor: 'var(--surface-1)',
                border: '1px solid var(--border-default)'
              }}
              whileHover={{ 
                borderColor: 'var(--border-hover)',
                y: -4
              }}
            >
              <div 
                className="inline-flex items-center justify-center w-10 h-10 rounded-lg mb-3"
                style={{ backgroundColor: 'var(--surface-2)' }}
              >
                <span style={{ color: 'var(--color-primary)' }}>{tech.icon}</span>
              </div>
              <p className="font-medium" style={{ color: 'var(--text-1)' }}>{tech.name}</p>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>{tech.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Architecture Diagram */}
      <motion.section variants={itemVariants}>
        <div 
          className="p-8 rounded-2xl max-w-4xl mx-auto"
          style={{ 
            backgroundColor: 'var(--surface-1)',
            border: '1px solid var(--border-default)'
          }}
        >
          <h2 className="text-xl font-bold mb-6" style={{ color: 'var(--text-1)' }}>
            System Architecture
          </h2>
          
          {/* Simplified architecture visualization */}
          <div className="grid grid-cols-3 gap-6">
            {/* Client */}
            <div 
              className="p-4 rounded-xl text-center"
              style={{ backgroundColor: 'var(--surface-2)' }}
            >
              <h3 className="font-medium mb-2" style={{ color: 'var(--text-1)' }}>Frontend</h3>
              <div className="space-y-1 text-sm" style={{ color: 'var(--text-2)' }}>
                <p>React + Vite</p>
                <p>Zustand State</p>
                <p>Socket.IO Client</p>
              </div>
            </div>

            {/* API Layer */}
            <div 
              className="p-4 rounded-xl text-center"
              style={{ backgroundColor: 'var(--surface-2)' }}
            >
              <h3 className="font-medium mb-2" style={{ color: 'var(--text-1)' }}>Backend</h3>
              <div className="space-y-1 text-sm" style={{ color: 'var(--text-2)' }}>
                <p>Express.js API</p>
                <p>Socket.IO Server</p>
                <p>Redis Cache</p>
              </div>
            </div>

            {/* Data Layer */}
            <div 
              className="p-4 rounded-xl text-center"
              style={{ backgroundColor: 'var(--surface-2)' }}
            >
              <h3 className="font-medium mb-2" style={{ color: 'var(--text-1)' }}>Data & ML</h3>
              <div className="space-y-1 text-sm" style={{ color: 'var(--text-2)' }}>
                <p>TimescaleDB</p>
                <p>Python FastAPI</p>
                <p>ML Models</p>
              </div>
            </div>
          </div>

          {/* Flow arrows */}
          <div className="flex justify-center items-center gap-8 my-4">
            <span style={{ color: 'var(--text-3)' }}>→</span>
            <span style={{ color: 'var(--text-3)' }}>REST/WS</span>
            <span style={{ color: 'var(--text-3)' }}>→</span>
          </div>
        </div>
      </motion.section>

      {/* Footer */}
      <motion.footer 
        className="text-center py-8"
        variants={itemVariants}
      >
        <p style={{ color: 'var(--text-3)' }}>
          © 2026 Roneira Enterprises. Built with ❤️ for investors everywhere.
        </p>
        <div className="flex items-center justify-center gap-4 mt-4">
          <a 
            href="#" 
            className="text-sm flex items-center gap-1"
            style={{ color: 'var(--color-primary)' }}
          >
            Documentation <ExternalLink size={12} />
          </a>
          <a 
            href="#" 
            className="text-sm flex items-center gap-1"
            style={{ color: 'var(--color-primary)' }}
          >
            API Reference <ExternalLink size={12} />
          </a>
          <a 
            href="#" 
            className="text-sm flex items-center gap-1"
            style={{ color: 'var(--color-primary)' }}
          >
            Support <ExternalLink size={12} />
          </a>
        </div>
      </motion.footer>
    </motion.div>
  );
};

export default AboutPage;

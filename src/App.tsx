import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/electron-vite.animate.svg'
import './App.css'

function App() {
  const [input, setInput] = useState("")
  const [output, setOutput] = useState("")
  const [loading, setLoading] = useState(false)

  const handleExplain = async () => {
    if (!input.trim()) {
      setOutput("Please enter some text to explain.")
      return
    }

    setLoading(true)
    setOutput("")

    try {
      // @ts-ignore
      const result = await window.ai.explainText(input)
      setOutput(result)
    } catch (err) {
      setOutput("Error occurred: " + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  // Function to read from clipboard and set input
  const handleExplainClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()

      if (!text.trim()) {
        setOutput("Clipboard is empty.")
        return
      }

      setInput(text)
      setOutput("Clipboard text loaded. Click Explain to continue.")
    } catch (err) {
      setOutput("Could not read clipboard.")
    }
  }

  return (
    <>
      <div>
        <a href="https://electron-vite.github.io" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <textarea
        placeholder="Paste code, errors, or text here..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />
      <div className="card">
        <button onClick={handleExplain} disabled={loading}>
          {loading ? "Loading..." : "Explain Text"}
        </button>

        <button onClick={handleExplainClipboard}>
          Explain Clipboard
        </button>
      </div>
      <div className="output">
        {output}
      </div>
    </>
  )
}

export default App

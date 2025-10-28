import { useEffect, useRef } from "react"

export function GradientBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext("2d")
        if (!ctx) return

        const setCanvasDimensions = () => {
            canvas.width = window.innerWidth
            canvas.height = window.innerHeight * 1.5
        }

        setCanvasDimensions()
        window.addEventListener("resize", setCanvasDimensions)

        // Center point
        const centerX = canvas.width / 2
        const centerY = canvas.height / 2

        // Create gradient blobs fixed around center
        const blobs = [
            { x: centerX, y: centerY, radius: 350, dx: 0.05, dy: 0.04, hue: 240 },
            { x: centerX - 200, y: centerY - 150, radius: 280, dx: -0.03, dy: 0.02, hue: 260 },
            { x: centerX + 220, y: centerY + 120, radius: 250, dx: 0.04, dy: -0.02, hue: 280 },
        ]

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height)

            blobs.forEach((blob) => {
                const gradient = ctx.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, blob.radius)
                gradient.addColorStop(0, `hsla(${blob.hue}, 80%, 60%, 0.3)`)
                gradient.addColorStop(1, `hsla(${blob.hue}, 80%, 60%, 0)`)

                ctx.fillStyle = gradient
                ctx.beginPath()
                ctx.arc(blob.x, blob.y, blob.radius, 0, Math.PI * 2)
                ctx.fill()

                // Gentle float
                blob.x += blob.dx
                blob.y += blob.dy

                if (blob.x < 0 || blob.x > canvas.width) blob.dx *= -1
                if (blob.y < 0 || blob.y > canvas.height) blob.dy *= -1
            })

            requestAnimationFrame(animate)
        }

        animate()

        return () => {
            window.removeEventListener("resize", setCanvasDimensions)
        }
    }, [])

    return (
        <canvas
            ref={canvasRef}
            className="fixed top-0 left-0 w-full h-full -z-10 opacity-70"
            aria-hidden="true"
        />
    )
}

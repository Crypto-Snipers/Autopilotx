"use client"

import { useEffect, useRef } from "react"

interface SoundWaveAnimationProps {
    className?: string
}

export function SoundWave({ className }: SoundWaveAnimationProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext("2d")
        if (!ctx) return

        // Set canvas dimensions
        const setCanvasDimensions = () => {
            canvas.width = window.innerWidth
            canvas.height = 400
        }

        setCanvasDimensions()
        window.addEventListener("resize", setCanvasDimensions)

        // Wave parameters with increased opacity and added stroke colors
        const waves = [
            {
                amplitude: 40,
                frequency: 0.005,
                speed: 0.08,
                color: "rgba(59, 130, 246, 0.35)",
                strokeColor: "rgba(59, 130, 246, 0.5)",
                offset: 0,
            },
            {
                amplitude: 25,
                frequency: 0.015,
                speed: 0.06,
                color: "rgba(99, 102, 241, 0.3)",
                strokeColor: "rgba(99, 102, 241, 0.45)",
                offset: 100,
            },
            {
                amplitude: 15,
                frequency: 0.025,
                speed: 0.08,
                color: "rgba(139, 92, 246, 0.25)",
                strokeColor: "rgba(139, 92, 246, 0.4)",
                offset: 200,
            },
            {
                amplitude: 30,
                frequency: 0.01,
                speed: 0.08,
                color: "rgba(79, 70, 229, 0.3)",
                strokeColor: "rgba(79, 70, 229, 0.45)",
                offset: 300,
            },
        ]

        let animationFrameId: number
        let time = 0

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height)

            waves.forEach((wave) => {
                drawWave(ctx, wave, time, canvas.width, canvas.height)
            })

            time += 0.05
            animationFrameId = requestAnimationFrame(animate)
        }

        const drawWave = (
            ctx: CanvasRenderingContext2D,
            wave: {
                amplitude: number
                frequency: number
                speed: number
                color: string
                strokeColor: string
                offset: number
            },
            time: number,
            width: number,
            height: number,
        ) => {
            const { amplitude, frequency, speed, color, strokeColor, offset } = wave
            const y = height / 2

            // First draw the filled wave
            ctx.beginPath()

            // Store the wave points to reuse for stroke
            const points: [number, number][] = []

            // Draw the top curve of the wave
            for (let x = 0; x < width; x++) {
                // Create a sine wave pattern
                const dx = x * frequency
                const sine = Math.sin(dx + time * speed + offset)
                const dy = sine * amplitude

                const point: [number, number] = [x, y + dy]
                points.push(point)

                if (x === 0) {
                    ctx.moveTo(x, y + dy)
                } else {
                    ctx.lineTo(x, y + dy)
                }
            }

            // Complete the path by drawing to the bottom right and back to start
            ctx.lineTo(width, height)
            ctx.lineTo(0, height)
            ctx.closePath()

            // Fill with gradient
            const gradient = ctx.createLinearGradient(0, 0, 0, height)
            gradient.addColorStop(0, color)
            gradient.addColorStop(1, "rgba(255, 255, 255, 0)")
            ctx.fillStyle = gradient
            ctx.fill()

            // Now draw just the top curve with a stroke for more visibility
            ctx.beginPath()
            points.forEach((point, index) => {
                if (index === 0) {
                    ctx.moveTo(point[0], point[1])
                } else {
                    ctx.lineTo(point[0], point[1])
                }
            })

            ctx.strokeStyle = strokeColor
            ctx.lineWidth = 1.5
            ctx.stroke()
        }

        animate()

        return () => {
            window.removeEventListener("resize", setCanvasDimensions)
            cancelAnimationFrame(animationFrameId)
        }
    }, [])

    return <canvas ref={canvasRef} className={`absolute w-full h-[400px] opacity-80 ${className}`} aria-hidden="true" />
}

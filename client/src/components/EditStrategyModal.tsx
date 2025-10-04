"use client"

import React, { useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiRequest } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"

export type StrategyConfig = {
    _id: string
    SYMBOL: "BTC" | "ETH"
    TimeFrame: string
    SMA_PERIOD: number
    PATTERN_PERCENTAGE: number
    SMA_DISTANCE_PERCENTAGE: number
    STOPLOSS_BUFFER_PERCENTAGE: number
    RISK_REWARD_RATIO: number
    TRAIL_RATIO: number
    TARGET_RATIO_FINAL: number
    EXIT_1_PERCENTAGE: number
}

type NumericKeys =
    | "SMA_PERIOD"
    | "PATTERN_PERCENTAGE"
    | "SMA_DISTANCE_PERCENTAGE"
    | "STOPLOSS_BUFFER_PERCENTAGE"
    | "RISK_REWARD_RATIO"
    | "TRAIL_RATIO"
    | "TARGET_RATIO_FINAL"
    | "EXIT_1_PERCENTAGE"


// Keep numeric fields as strings for smooth typing; convert on save
type StrategyForm = Omit<StrategyConfig, NumericKeys> & Record<NumericKeys, string>

export interface StrategyEditModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    initial: StrategyConfig
    onSave: (data: StrategyConfig) => void
}

function toFormState(initial: StrategyConfig): StrategyForm {
    return {
        _id: initial._id,
        SYMBOL: initial.SYMBOL,
        TimeFrame: initial.TimeFrame,
        SMA_PERIOD: String(initial.SMA_PERIOD),
        PATTERN_PERCENTAGE: String(initial.PATTERN_PERCENTAGE),
        SMA_DISTANCE_PERCENTAGE: String(initial.SMA_DISTANCE_PERCENTAGE),
        STOPLOSS_BUFFER_PERCENTAGE: String(initial.STOPLOSS_BUFFER_PERCENTAGE),
        RISK_REWARD_RATIO: String(initial.RISK_REWARD_RATIO),
        TRAIL_RATIO: String(initial.TRAIL_RATIO),
        TARGET_RATIO_FINAL: String(initial.TARGET_RATIO_FINAL),
        EXIT_1_PERCENTAGE: String(initial.EXIT_1_PERCENTAGE),
    }
}

type Errors = Partial<Record<keyof StrategyConfig, string>>

export default function StrategyEditModal({ open, onOpenChange, initial, onSave }: StrategyEditModalProps) {
    const [form, setForm] = React.useState<StrategyForm>(toFormState(initial))
    const { toast } = useToast()

    React.useEffect(() => {
        if (open) setForm(toFormState(initial))
    }, [open, initial])

    const errors: Errors = React.useMemo(() => {
        const e: Errors = {}
        const getNum = (k: NumericKeys) => {
            const v = Number(form[k])
            return Number.isFinite(v) ? v : Number.NaN
        }

        if (!form._id.trim()) e._id = "Required"
        if (!form.TimeFrame.trim()) e.TimeFrame = "Required"

        const sma = getNum("SMA_PERIOD")
        if (!Number.isInteger(sma) || sma < 1) e.SMA_PERIOD = "Must be an integer ≥ 1"

        const pct = (k: NumericKeys, label: string, allowFloat = true) => {
            const v = getNum(k)
            if (!Number.isFinite(v) || v < 0 || v > 100) e[k as keyof StrategyConfig] = `${label} must be between 0 and 100`
            if (!allowFloat && !Number.isInteger(v)) e[k as keyof StrategyConfig] = `${label} must be an integer`
        }

        pct("PATTERN_PERCENTAGE", "Pattern %")
        pct("SMA_DISTANCE_PERCENTAGE", "SMA Distance %")
        pct("STOPLOSS_BUFFER_PERCENTAGE", "Stoploss Buffer %")
        pct("EXIT_1_PERCENTAGE", "Exit 1 %", true)

        const rrr = getNum("RISK_REWARD_RATIO")
        if (!(rrr > 0)) e.RISK_REWARD_RATIO = "Must be > 0"

        const trail = getNum("TRAIL_RATIO")
        if (!(trail >= 0)) e.TRAIL_RATIO = "Must be ≥ 0"

        const target = getNum("TARGET_RATIO_FINAL")
        if (!(target > 0)) e.TARGET_RATIO_FINAL = "Must be > 0"

        return e
    }, [form])

    const hasErrors = React.useMemo(() => Object.keys(errors).length > 0, [errors])

    const handleChange = (key: keyof StrategyForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm((f) => ({ ...f, [key]: e.target.value }))
    }

    // Update strategy information

    const handleSubmit = async () => {
        if (hasErrors) return
        const toNum = (k: NumericKeys) => Number(form[k])
        const payload: StrategyConfig = {
            _id: form._id.trim(),
            SYMBOL: form.SYMBOL,
            TimeFrame: form.TimeFrame.trim(),
            SMA_PERIOD: Math.trunc(toNum("SMA_PERIOD")),
            PATTERN_PERCENTAGE: toNum("PATTERN_PERCENTAGE"),
            SMA_DISTANCE_PERCENTAGE: toNum("SMA_DISTANCE_PERCENTAGE"),
            STOPLOSS_BUFFER_PERCENTAGE: toNum("STOPLOSS_BUFFER_PERCENTAGE"),
            RISK_REWARD_RATIO: toNum("RISK_REWARD_RATIO"),
            TRAIL_RATIO: toNum("TRAIL_RATIO"),
            TARGET_RATIO_FINAL: toNum("TARGET_RATIO_FINAL"),
            EXIT_1_PERCENTAGE: toNum("EXIT_1_PERCENTAGE"),
        }

        try {
            const response = await apiRequest<{
                status: string,
                message: string,
                new_config: StrategyConfig
            }>(
                "PUT",
                `/api/update_strategy/?symbol=${encodeURIComponent(payload.SYMBOL)}`,
                payload
            )
            if (response?.status === "success") {
                // update parent with backend-confirmed config
                onSave(response.new_config)
                onOpenChange(false)
                toast({
                    title: "Success",
                    description: `Trading strategy saved successfully.`,
                })
            } else {
                console.error("Failed to update Trading strategy: ", response)
                toast({
                    title: "Error",
                    description: `Failed to update Trading strategy.`,
                    variant: "destructive",
                })
            }

        } catch (error) {
            console.error("Failed to update Trading strategy: ", error)
        }

    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="text-pretty">Edit Strategy</DialogTitle>
                    <DialogDescription>Update configuration values and save your changes.</DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {/* <div className="space-y-2">
                        <Label htmlFor="_id">ID</Label>
                        <Input id="_id" value={form._id} onChange={handleChange("_id")} placeholder="e.g. pankaj_stra_BTC" />
                        {errors._id && <p className="text-sm text-red-600">{errors._id}</p>}
                    </div> */}

                    {/* <div className="space-y-2">
                        <Label htmlFor="SYMBOL">Symbol</Label>
                        <Select value={form.SYMBOL} onValueChange={(val: "BTC" | "ETH") => setForm((f) => ({ ...f, SYMBOL: val }))}>
                            <SelectTrigger id="SYMBOL">
                                <SelectValue placeholder="Select symbol" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="BTC">BTC</SelectItem>
                                <SelectItem value="ETH">ETH</SelectItem>
                            </SelectContent>
                        </Select>
                    </div> */}

                    <div className="space-y-2">
                        <Label htmlFor="TimeFrame">Time Frame</Label>
                        <Input id="TimeFrame" value={form.TimeFrame} onChange={handleChange("TimeFrame")} placeholder="e.g. 1Min" />
                        {errors.TimeFrame && <p className="text-sm text-red-600">{errors.TimeFrame}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="SMA_PERIOD">SMA Period</Label>
                        <Input
                            id="SMA_PERIOD"
                            inputMode="numeric"
                            type="number"
                            step={1}
                            min={1}
                            value={form.SMA_PERIOD}
                            onChange={handleChange("SMA_PERIOD")}
                            placeholder="e.g. 200"
                        />
                        {errors.SMA_PERIOD && <p className="text-sm text-red-600">{errors.SMA_PERIOD}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="PATTERN_PERCENTAGE">Pattern %</Label>
                        <Input
                            id="PATTERN_PERCENTAGE"
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={form.PATTERN_PERCENTAGE}
                            onChange={handleChange("PATTERN_PERCENTAGE")}
                            placeholder="e.g. 1"
                        />
                        {errors.PATTERN_PERCENTAGE && <p className="text-sm text-red-600">{errors.PATTERN_PERCENTAGE}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="SMA_DISTANCE_PERCENTAGE">SMA Distance %</Label>
                        <Input
                            id="SMA_DISTANCE_PERCENTAGE"
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={form.SMA_DISTANCE_PERCENTAGE}
                            onChange={handleChange("SMA_DISTANCE_PERCENTAGE")}
                            placeholder="e.g. 1"
                        />
                        {errors.SMA_DISTANCE_PERCENTAGE && <p className="text-sm text-red-600">{errors.SMA_DISTANCE_PERCENTAGE}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="STOPLOSS_BUFFER_PERCENTAGE">Stoploss Buffer %</Label>
                        <Input
                            id="STOPLOSS_BUFFER_PERCENTAGE"
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={form.STOPLOSS_BUFFER_PERCENTAGE}
                            onChange={handleChange("STOPLOSS_BUFFER_PERCENTAGE")}
                            placeholder="e.g. 0.1"
                        />
                        {errors.STOPLOSS_BUFFER_PERCENTAGE && (
                            <p className="text-sm text-red-600">{errors.STOPLOSS_BUFFER_PERCENTAGE}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="RISK_REWARD_RATIO">Risk/Reward Ratio</Label>
                        <Input
                            id="RISK_REWARD_RATIO"
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={form.RISK_REWARD_RATIO}
                            onChange={handleChange("RISK_REWARD_RATIO")}
                            placeholder="e.g. 3"
                        />
                        {errors.RISK_REWARD_RATIO && <p className="text-sm text-red-600">{errors.RISK_REWARD_RATIO}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="TRAIL_RATIO">Trail Ratio</Label>
                        <Input
                            id="TRAIL_RATIO"
                            type="number"
                            step="0.1"
                            min="0"
                            value={form.TRAIL_RATIO}
                            onChange={handleChange("TRAIL_RATIO")}
                            placeholder="e.g. 2"
                        />
                        {errors.TRAIL_RATIO && <p className="text-sm text-red-600">{errors.TRAIL_RATIO}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="TARGET_RATIO_FINAL">Target Ratio (Final)</Label>
                        <Input
                            id="TARGET_RATIO_FINAL"
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={form.TARGET_RATIO_FINAL}
                            onChange={handleChange("TARGET_RATIO_FINAL")}
                            placeholder="e.g. 5"
                        />
                        {errors.TARGET_RATIO_FINAL && <p className="text-sm text-red-600">{errors.TARGET_RATIO_FINAL}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="EXIT_1_PERCENTAGE">Exit 1 %</Label>
                        <Input
                            id="EXIT_1_PERCENTAGE"
                            type="number"
                            step="1"
                            min="0"
                            max="100"
                            value={form.EXIT_1_PERCENTAGE}
                            onChange={handleChange("EXIT_1_PERCENTAGE")}
                            placeholder="e.g. 50"
                        />
                        {errors.EXIT_1_PERCENTAGE && <p className="text-sm text-red-600">{errors.EXIT_1_PERCENTAGE}</p>}
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={hasErrors}>
                        Save changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

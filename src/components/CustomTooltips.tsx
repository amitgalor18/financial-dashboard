export const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 shadow-xl">
          <p className="text-white font-medium">{`Month: ${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-gray-300" style={{ color: entry.color }}>
              {`${entry.name}: ${typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}`}
            </p>
          ))}
        </div>
      )
    }
    return null
}

export const PieTooltip = ({ active, payload, selectedMonth }: any) => {
    if (active && payload && payload.length) {
      const p = payload[0]?.payload ?? {}
      const category = p.category ?? ''
      const amount = typeof p.amount === 'number' ? p.amount : Number(p.amount || 0)
      return (
        <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 shadow-xl">
          <p className="text-white font-medium">{`Month: ${selectedMonth || '—'}`}</p>
          <p className="text-gray-300">
            {`${category}: ₪${Math.round(amount).toLocaleString()}`}
          </p>
        </div>
      )
    }
    return null
}

export const CurrencyTooltip = ({ active, payload, label, title }: any) => {
    if (active && payload && payload.length) {
      const v = typeof payload[0].value === 'number' ? payload[0].value : Number(payload[0].value || 0)
      return (
        <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 shadow-xl">
          {title && <p className="text-white font-medium">{title}</p>}
          {label && <p className="text-gray-300">{label}</p>}
          <p className="text-gray-300">₪{Math.round(v).toLocaleString()}</p>
        </div>
      )
    }
    return null
}


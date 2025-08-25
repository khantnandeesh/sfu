export default function ResponsiveContainer({ children, className = "", maxWidth = "max-w-7xl" }) {
    return (
        <div className={`w-full mx-auto px-4 sm:px-6 lg:px-8 ${maxWidth} ${className}`}>
            {children}
        </div>
    )
}

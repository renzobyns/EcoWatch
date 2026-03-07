export default function DashboardPage() {
    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold text-gradient mb-8">CENRO Analytics Dashboard</h1>
            <div className="glass p-12 text-center text-foreground/50 border-dashed border-2 border-primary/10">
                <p className="text-xl">Dashboard Visualizations Loading...</p>
                <p className="text-sm mt-4 italic">Geo-spatial clustering (DBSCAN) engine starting...</p>
            </div>
        </div>
    );
}

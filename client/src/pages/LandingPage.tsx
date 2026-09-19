import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Star, QrCode, BarChart3, Shield } from 'lucide-react';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white">
      <header className="max-w-5xl mx-auto px-4 py-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-primary-600">ReputeAI</h1>
        <div className="flex gap-3">
          <Link to="/login">
            <Button variant="ghost" size="sm">Sign In</Button>
          </Link>
          <Link to="/signup">
            <Button size="sm">Get Started</Button>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h2 className="text-4xl font-bold text-gray-900 mb-4">
          Turn Customer Feedback Into<br />
          <span className="text-primary-600">Authentic Google Reviews</span>
        </h2>
        <p className="text-lg text-gray-600 mb-10 max-w-2xl mx-auto">
          Help your customers share their genuine experience with AI-powered review drafts.
          No fake reviews. No manipulation. Just authentic voices amplified.
        </p>

        <div className="flex gap-4 justify-center mb-20">
          <Link to="/signup">
            <Button size="lg">Start Free</Button>
          </Link>
          <Link to="/review/bellas-kitchen">
            <Button variant="outline" size="lg">See Demo</Button>
          </Link>
        </div>

        <div className="grid md:grid-cols-4 gap-8 text-left">
          {[
            { icon: QrCode, title: 'QR to Review', desc: 'Customer scans, rates, and reviews in 30 seconds' },
            { icon: Star, title: 'AI Drafts', desc: 'Three authentic review styles generated from real feedback' },
            { icon: BarChart3, title: 'Real Analytics', desc: 'Track feedback, ratings, and conversion from your dashboard' },
            { icon: Shield, title: 'No Fake Reviews', desc: 'AI only uses what customers actually said — nothing invented' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-6 bg-white rounded-xl border shadow-sm">
              <Icon className="w-8 h-8 text-primary-600 mb-3" />
              <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
              <p className="text-sm text-gray-500">{desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

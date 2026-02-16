import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import { authApi } from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';

export function LoginPage() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const { setAuth } = useAuthStore();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!isLogin && password !== confirmPassword) {
            setError('两次输入的密码不一致');
            return;
        }

        setIsLoading(true);
        try {
            const result = isLogin
                ? await authApi.login(email, password)
                : await authApi.register(email, password);
            setAuth(result.user, result.token);
        } catch (err) {
            setError(err instanceof Error ? err.message : '操作失败');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-sm space-y-8"
            >
                {/* Logo */}
                <div className="text-center space-y-3">
                    <div className="text-5xl">🧾</div>
                    <h1 className="text-2xl font-black">
                        <span className="text-primary">花</span>在哪里了
                    </h1>
                    <p className="text-text-muted text-sm">
                        {isLogin ? '登录你的账户' : '创建新账户'}
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="bg-white p-3.5 rounded-2xl border border-stone-100 flex items-center gap-3">
                        <Mail className="w-5 h-5 text-stone-400 shrink-0" />
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="邮箱"
                            required
                            className="flex-1 outline-none text-sm bg-transparent placeholder:text-stone-300"
                        />
                    </div>

                    <div className="bg-white p-3.5 rounded-2xl border border-stone-100 flex items-center gap-3">
                        <Lock className="w-5 h-5 text-stone-400 shrink-0" />
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="密码"
                            required
                            minLength={6}
                            className="flex-1 outline-none text-sm bg-transparent placeholder:text-stone-300"
                        />
                    </div>

                    {!isLogin && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="bg-white p-3.5 rounded-2xl border border-stone-100 flex items-center gap-3"
                        >
                            <ShieldCheck className="w-5 h-5 text-stone-400 shrink-0" />
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="确认密码"
                                required
                                minLength={6}
                                className="flex-1 outline-none text-sm bg-transparent placeholder:text-stone-300"
                            />
                        </motion.div>
                    )}

                    {error && (
                        <p className="text-danger text-xs text-center">{error}</p>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-primary text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 text-sm active:scale-[0.98] transition-transform disabled:opacity-50"
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                {isLogin ? '登录' : '注册'}
                                <ArrowRight className="w-4 h-4" />
                            </>
                        )}
                    </button>
                </form>

                <div className="text-center">
                    <button
                        type="button"
                        onClick={() => { setIsLogin(!isLogin); setError(''); setConfirmPassword(''); }}
                        className="text-text-muted text-xs hover:text-primary transition-colors"
                    >
                        {isLogin ? '没有账号？注册' : '已有账号？登录'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}

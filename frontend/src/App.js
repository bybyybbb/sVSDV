import React, { useState, useEffect } from 'react';
import { 
  PlayCircle, 
  StopCircle, 
  Users, 
  MessageSquare, 
  Settings, 
  Activity,
  Plus,
  Trash2,
  Power,
  PowerOff,
  TwitterIcon,
  Bot,
  AlertCircle,
  CheckCircle,
  Clock,
  Target,
  Download,
  Smartphone,
  Monitor
} from 'lucide-react';
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './components/ui/card';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Textarea } from './components/ui/textarea';
import { Switch } from './components/ui/switch';
import { Badge } from './components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Alert, AlertDescription } from './components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

function App() {
  const [botStatus, setBotStatus] = useState({
    running: false,
    connected: false,
    user: null
  });
  const [targetAccounts, setTargetAccounts] = useState([]);
  const [comments, setComments] = useState([]);
  const [settings, setSettings] = useState({
    is_active: true,
    comments_per_day: 10,
    min_delay_minutes: 30,
    max_delay_minutes: 180,
    comment_categories: ['general', 'bullish', 'ironic']
  });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showPWAPrompt, setShowPWAPrompt] = useState(false);

  // Form states
  const [newAccountUsername, setNewAccountUsername] = useState('');
  const [newComment, setNewComment] = useState({ text: '', category: 'general' });

  useEffect(() => {
    initializeApp();
    checkPWAStatus();
  }, []);

  const checkPWAStatus = () => {
    // Prüfe ob als PWA läuft
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSStandalone = window.navigator.standalone === true;
    setIsStandalone(isStandaloneMode || isIOSStandalone);
    
    // Zeige PWA-Prompt wenn nicht installiert
    if (!isStandaloneMode && !isIOSStandalone) {
      setTimeout(() => setShowPWAPrompt(true), 3000);
    }
  };

  const initializeApp = async () => {
    await Promise.all([
      fetchBotStatus(),
      fetchTargetAccounts(),
      fetchComments(),
      fetchSettings(),
      fetchLogs()
    ]);
  };

  const showAlert = (message, type = 'success') => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 5000);
  };

  const apiCall = async (endpoint, options = {}) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
        },
        ...options
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'API call failed');
      }
      
      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  };

  // API Calls
  const fetchBotStatus = async () => {
    try {
      const [healthResponse, twitterResponse] = await Promise.all([
        apiCall('/health'),
        apiCall('/twitter/verify').catch(() => ({ status: 'disconnected' }))
      ]);
      
      setBotStatus({
        running: healthResponse.bot_running,
        connected: twitterResponse.status === 'connected',
        user: twitterResponse.user || null
      });
    } catch (error) {
      console.error('Failed to fetch bot status:', error);
    }
  };

  const fetchTargetAccounts = async () => {
    try {
      const response = await apiCall('/target-accounts');
      setTargetAccounts(response.accounts);
    } catch (error) {
      console.error('Failed to fetch target accounts:', error);
    }
  };

  const fetchComments = async () => {
    try {
      const response = await apiCall('/comments');
      setComments(response.comments);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await apiCall('/settings');
      setSettings(response.settings);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  };

  const fetchLogs = async () => {
    try {
      const response = await apiCall('/logs');
      setLogs(response.logs);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
  };

  // Bot Control
  const startBot = async () => {
    try {
      setLoading(true);
      await apiCall('/bot/start', { method: 'POST' });
      setBotStatus(prev => ({ ...prev, running: true }));
      showAlert('Bot started successfully! 🚀');
      fetchLogs();
    } catch (error) {
      showAlert(`Failed to start bot: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const stopBot = async () => {
    try {
      setLoading(true);
      await apiCall('/bot/stop', { method: 'POST' });
      setBotStatus(prev => ({ ...prev, running: false }));
      showAlert('Bot stopped successfully');
      fetchLogs();
    } catch (error) {
      showAlert(`Failed to stop bot: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Target Account Management
  const addTargetAccount = async () => {
    if (!newAccountUsername.trim()) return;
    
    try {
      setLoading(true);
      await apiCall('/target-accounts', {
        method: 'POST',
        body: JSON.stringify({
          username: newAccountUsername.replace('@', ''),
          is_active: true
        })
      });
      
      setNewAccountUsername('');
      fetchTargetAccounts();
      showAlert(`Target account @${newAccountUsername} added successfully!`);
    } catch (error) {
      showAlert(`Failed to add account: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleTargetAccount = async (accountId) => {
    try {
      await apiCall(`/target-accounts/${accountId}/toggle`, { method: 'PUT' });
      fetchTargetAccounts();
      showAlert('Account status updated successfully');
    } catch (error) {
      showAlert(`Failed to update account: ${error.message}`, 'error');
    }
  };

  const deleteTargetAccount = async (accountId) => {
    try {
      await apiCall(`/target-accounts/${accountId}`, { method: 'DELETE' });
      fetchTargetAccounts();
      showAlert('Account deleted successfully');
    } catch (error) {
      showAlert(`Failed to delete account: ${error.message}`, 'error');
    }
  };

  // Comment Management
  const addComment = async () => {
    if (!newComment.text.trim()) return;
    
    try {
      setLoading(true);
      await apiCall('/comments', {
        method: 'POST',
        body: JSON.stringify(newComment)
      });
      
      setNewComment({ text: '', category: 'general' });
      fetchComments();
      showAlert('Comment added successfully!');
    } catch (error) {
      showAlert(`Failed to add comment: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const deleteComment = async (commentId) => {
    try {
      await apiCall(`/comments/${commentId}`, { method: 'DELETE' });
      fetchComments();
      showAlert('Comment deleted successfully');
    } catch (error) {
      showAlert(`Failed to delete comment: ${error.message}`, 'error');
    }
  };

  // Settings Management
  const updateSettings = async () => {
    try {
      setLoading(true);
      await apiCall('/settings', {
        method: 'PUT',
        body: JSON.stringify(settings)
      });
      showAlert('Settings updated successfully!');
    } catch (error) {
      showAlert(`Failed to update settings: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-3 rounded-lg">
                <Bot className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-white">Twitter Engagement Bot</h1>
                <p className="text-slate-300">Automated memecoin engagement tool</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Connection Status */}
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${botStatus.connected ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-sm text-slate-300">
                      {botStatus.connected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                  {botStatus.user && (
                    <p className="text-xs text-slate-400 mt-1">@{botStatus.user.username}</p>
                  )}
                </CardContent>
              </Card>
              
              {/* Bot Control */}
              <Button
                onClick={botStatus.running ? stopBot : startBot}
                disabled={loading || !botStatus.connected}
                className={`px-6 py-3 ${
                  botStatus.running 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {botStatus.running ? (
                  <>
                    <StopCircle className="w-5 h-5 mr-2" />
                    Stop Bot
                  </>
                ) : (
                  <>
                    <PlayCircle className="w-5 h-5 mr-2" />
                    Start Bot
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Alert */}
        {alert && (
          <Alert className={`mb-6 ${
            alert.type === 'error' 
              ? 'border-red-500 bg-red-500/10 text-red-400' 
              : 'border-green-500 bg-green-500/10 text-green-400'
          }`}>
            <AlertDescription>{alert.message}</AlertDescription>
          </Alert>
        )}

        {/* Main Content */}
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 bg-slate-800 border-slate-700">
            <TabsTrigger value="dashboard" className="text-slate-300">
              <Activity className="w-4 h-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="targets" className="text-slate-300">
              <Target className="w-4 h-4 mr-2" />
              Targets
            </TabsTrigger>
            <TabsTrigger value="comments" className="text-slate-300">
              <MessageSquare className="w-4 h-4 mr-2" />
              Comments
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-slate-300">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="logs" className="text-slate-300">
              <Activity className="w-4 h-4 mr-2" />
              Logs
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-slate-100 text-sm font-medium flex items-center">
                    <Users className="w-4 h-4 mr-2" />
                    Target Accounts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{targetAccounts.length}</div>
                  <p className="text-xs text-slate-400">
                    {targetAccounts.filter(acc => acc.is_active).length} active
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-slate-800 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-slate-100 text-sm font-medium flex items-center">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Comments Pool
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{comments.length}</div>
                  <p className="text-xs text-slate-400">
                    {comments.filter(c => c.is_active).length} active
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-slate-800 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-slate-100 text-sm font-medium flex items-center">
                    <Bot className="w-4 h-4 mr-2" />
                    Bot Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">
                    {botStatus.running ? 'Running' : 'Stopped'}
                  </div>
                  <p className="text-xs text-slate-400">
                    {botStatus.connected ? 'Connected to Twitter' : 'Disconnected'}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-slate-800 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-slate-100 text-sm font-medium flex items-center">
                    <Activity className="w-4 h-4 mr-2" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{logs.length}</div>
                  <p className="text-xs text-slate-400">
                    {logs.filter(log => log.status === 'success').length} successful
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-slate-100">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {logs.slice(0, 5).map((log, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(log.status)}
                        <div>
                          <p className="text-slate-100 text-sm">{log.comment_text}</p>
                          <p className="text-slate-400 text-xs">
                            @{log.target_username} • {formatTimestamp(log.timestamp)}
                          </p>
                        </div>
                      </div>
                      <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                        {log.status}
                      </Badge>
                    </div>
                  ))}
                  {logs.length === 0 && (
                    <p className="text-slate-400 text-center py-4">No recent activity</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Target Accounts Tab */}
          <TabsContent value="targets" className="space-y-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-slate-100">Add Target Account</CardTitle>
                <CardDescription className="text-slate-400">
                  Add crypto influencers to monitor for new tweets
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex space-x-4">
                  <Input
                    placeholder="Username (e.g., elonmusk)"
                    value={newAccountUsername}
                    onChange={(e) => setNewAccountUsername(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addTargetAccount()}
                    className="bg-slate-700 border-slate-600 text-slate-100"
                  />
                  <Button onClick={addTargetAccount} disabled={loading}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Account
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-slate-100">Target Accounts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {targetAccounts.map((account) => (
                    <div key={account.id} className="flex items-center justify-between p-4 bg-slate-700 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${account.is_active ? 'bg-green-500' : 'bg-gray-500'}`} />
                        <div>
                          <p className="text-slate-100 font-medium">@{account.username}</p>
                          {account.display_name && (
                            <p className="text-slate-400 text-sm">{account.display_name}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleTargetAccount(account.id)}
                        >
                          {account.is_active ? (
                            <PowerOff className="w-4 h-4" />
                          ) : (
                            <Power className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteTargetAccount(account.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {targetAccounts.length === 0 && (
                    <p className="text-slate-400 text-center py-8">
                      No target accounts yet. Add some crypto influencers to get started!
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Comments Tab */}
          <TabsContent value="comments" className="space-y-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-slate-100">Add Comment</CardTitle>
                <CardDescription className="text-slate-400">
                  Create engaging comments for your memecoin promotion
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <Textarea
                    placeholder="Enter your comment text (e.g., 'Still early for $PEPUMP gang 💎')"
                    value={newComment.text}
                    onChange={(e) => setNewComment({...newComment, text: e.target.value})}
                    className="bg-slate-700 border-slate-600 text-slate-100 min-h-[100px]"
                  />
                  <div className="flex space-x-4">
                    <Select
                      value={newComment.category}
                      onValueChange={(value) => setNewComment({...newComment, category: value})}
                    >
                      <SelectTrigger className="w-[180px] bg-slate-700 border-slate-600 text-slate-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600">
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="bullish">Bullish</SelectItem>
                        <SelectItem value="ironic">Ironic</SelectItem>
                        <SelectItem value="provocative">Provocative</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={addComment} disabled={loading}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Comment
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-slate-100">Comment Pool</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {comments.map((comment) => (
                    <div key={comment.id} className="p-4 bg-slate-700 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-slate-100 mb-2">{comment.text}</p>
                          <div className="flex items-center space-x-2">
                            <Badge variant="secondary">{comment.category}</Badge>
                            <span className="text-slate-400 text-xs">
                              Used {comment.usage_count} times
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteComment(comment.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {comments.length === 0 && (
                    <p className="text-slate-400 text-center py-8">
                      No comments yet. Add some engaging memecoin content!
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-slate-100">Bot Settings</CardTitle>
                <CardDescription className="text-slate-400">
                  Configure bot behavior and limits
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-slate-100">Bot Active</Label>
                    <p className="text-slate-400 text-sm">Enable/disable automatic commenting</p>
                  </div>
                  <Switch
                    checked={settings.is_active}
                    onCheckedChange={(checked) => setSettings({...settings, is_active: checked})}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-100">Comments per Day</Label>
                  <Input
                    type="number"
                    value={settings.comments_per_day}
                    onChange={(e) => setSettings({...settings, comments_per_day: parseInt(e.target.value)})}
                    className="bg-slate-700 border-slate-600 text-slate-100"
                  />
                  <p className="text-slate-400 text-sm">Maximum comments to post daily</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-100">Min Delay (minutes)</Label>
                    <Input
                      type="number"
                      value={settings.min_delay_minutes}
                      onChange={(e) => setSettings({...settings, min_delay_minutes: parseInt(e.target.value)})}
                      className="bg-slate-700 border-slate-600 text-slate-100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-100">Max Delay (minutes)</Label>
                    <Input
                      type="number"
                      value={settings.max_delay_minutes}
                      onChange={(e) => setSettings({...settings, max_delay_minutes: parseInt(e.target.value)})}
                      className="bg-slate-700 border-slate-600 text-slate-100"
                    />
                  </div>
                </div>

                <Button onClick={updateSettings} disabled={loading} className="w-full">
                  Save Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs" className="space-y-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-slate-100">Activity Logs</CardTitle>
                <CardDescription className="text-slate-400">
                  Monitor bot activity and engagement history
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {logs.map((log, index) => (
                    <div key={index} className="p-4 bg-slate-700 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          {getStatusIcon(log.status)}
                          <div className="flex-1">
                            <p className="text-slate-100 font-medium">{log.comment_text}</p>
                            <div className="flex items-center space-x-4 mt-2 text-sm text-slate-400">
                              <span>@{log.target_username}</span>
                              <span>{formatTimestamp(log.timestamp)}</span>
                              {log.tweet_url !== 'N/A' && (
                                <a 
                                  href={log.tweet_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-400 hover:text-blue-300"
                                >
                                  View Tweet
                                </a>
                              )}
                            </div>
                            {log.error_message && (
                              <p className="text-red-400 text-sm mt-1">{log.error_message}</p>
                            )}
                          </div>
                        </div>
                        <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                          {log.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {logs.length === 0 && (
                    <p className="text-slate-400 text-center py-8">
                      No activity logs yet. Start the bot to see engagement activity!
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default App;
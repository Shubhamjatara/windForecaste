import { AlertCircle, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <Alert variant="destructive" className="my-6 bg-white p-6"><AlertCircle size={18} /><AlertTitle>Unable to load forecast data</AlertTitle><AlertDescription className="mt-2"><p>{message}</p><div className="mt-4 flex flex-wrap gap-2"><Button onClick={onRetry} variant="outline" className="gap-2 text-foreground"><RefreshCw size={14} />Retry loading</Button></div></AlertDescription></Alert>
}

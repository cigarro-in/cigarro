import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';
import { cn } from '../../../components/ui/utils';

function AdminCard({ className, ...props }: React.ComponentProps<typeof Card>) {
  return <Card className={cn('gap-0 py-0', className)} {...props} />;
}

function AdminCardHeader({ className, ...props }: React.ComponentProps<typeof CardHeader>) {
  return <CardHeader className={cn('gap-1 border-b px-4 py-3', className)} {...props} />;
}

function AdminCardTitle({ className, ...props }: React.ComponentProps<typeof CardTitle>) {
  return <CardTitle className={cn('text-base', className)} {...props} />;
}

function AdminCardDescription({ className, ...props }: React.ComponentProps<typeof CardDescription>) {
  return <CardDescription className={className} {...props} />;
}

function AdminCardContent({ className, ...props }: React.ComponentProps<typeof CardContent>) {
  return <CardContent className={cn('space-y-3 p-4', className)} {...props} />;
}

export {
  AdminCard,
  AdminCardHeader,
  AdminCardTitle,
  AdminCardDescription,
  AdminCardContent,
};

import { Button } from "../../../../components/ui/button";
import { ArrowLeft, Loader2, Eye } from "lucide-react";

interface FormHeaderProps {
  title: string;
  isEditing: boolean;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  isDirty: boolean;
}

export function FormHeader({ 
  title, 
  isEditing, 
  isSaving, 
  onSave, 
  onCancel,
  onDelete,
  isDirty 
}: FormHeaderProps) {
  return (
    <div className="sticky top-0 z-30 bg-[var(--color-creme-light)] border-b border-[var(--color-coyote)] px-6 py-4 flex items-center justify-between mb-6 shadow-sm">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onCancel}
          className="text-[var(--color-dark)] hover:bg-[var(--color-coyote)]/20"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        
        <div>
          <h1 className="text-xl font-sans font-bold text-[var(--color-dark)]">
            {title}
          </h1>
          <p className="text-sm text-[var(--color-dark)]/60">
            {isEditing ? "Edit Product Details" : "Add New Product"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {isEditing && onDelete && (
          <Button
            variant="outline"
            onClick={() => {
              if (confirm("Are you sure you want to delete this product? This action cannot be undone.")) {
                onDelete();
              }
            }}
            className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 mr-2"
          >
            Delete Product
          </Button>
        )}

        {isEditing && (
          <Button
            variant="outline"
            className="border-[var(--color-coyote)] text-[var(--color-dark)]"
          >
            <Eye className="w-4 h-4 mr-2" />
            Preview
          </Button>
        )}
        
        <Button
          variant="outline"
          onClick={onCancel}
          className="border-[var(--color-coyote)] text-[var(--color-dark)] hover:bg-[var(--color-creme)]"
        >
          Discard
        </Button>
        
        <Button
          onClick={onSave}
          disabled={isSaving || !isDirty}
          className={`
            min-w-[100px]
            ${isDirty 
              ? "bg-[var(--color-dark)] text-[var(--color-creme-light)] hover:bg-[var(--color-canyon)]" 
              : "bg-[var(--color-coyote)] text-[var(--color-dark)]/50 cursor-not-allowed"
            }
          `}
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Product"
          )}
        </Button>
      </div>
    </div>
  );
}

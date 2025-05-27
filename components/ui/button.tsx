import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Pressable } from "react-native";
import { cn } from "@/lib/utils";
import { TextClassContext } from "@/components/ui/text";

const buttonVariants = cva(
	"group flex items-center justify-center rounded-lg web:ring-offset-background web:transition-all web:duration-200 web:ease-in-out web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-ring web:focus-visible:ring-offset-2 web:shadow-sm",
	{
		variants: {
			variant: {
				default: 
					"bg-primary shadow-lg shadow-primary/25 web:hover:shadow-xl web:hover:shadow-primary/30 web:hover:scale-[1.02] active:scale-[0.98] web:hover:bg-primary/90 active:bg-primary/90 border border-primary/20",
				destructive: 
					"bg-destructive shadow-lg shadow-destructive/25 web:hover:shadow-xl web:hover:shadow-destructive/30 web:hover:scale-[1.02] active:scale-[0.98] web:hover:bg-destructive/90 active:bg-destructive/90 border border-destructive/20",
				outline:
					"border-2 border-primary/30 bg-background shadow-md shadow-black/5 web:hover:bg-primary/5 web:hover:border-primary/50 web:hover:shadow-lg web:hover:scale-[1.01] active:scale-[0.99] active:bg-primary/10 active:border-primary/60",
				secondary: 
					"bg-secondary shadow-md shadow-black/10 web:hover:shadow-lg web:hover:scale-[1.01] active:scale-[0.99] web:hover:bg-secondary/80 active:bg-secondary/80 border border-secondary/30",
				ghost:
					"web:hover:bg-accent/80 web:hover:shadow-sm web:hover:scale-[1.01] active:scale-[0.99] active:bg-accent/60 web:transition-all web:duration-150",
				link: 
					"web:underline-offset-4 web:hover:underline web:focus:underline web:hover:scale-[1.02] active:scale-[0.98] web:transition-transform web:duration-150",
			},
			size: {
				default: "h-12 px-6 py-3 native:h-14 native:px-7 native:py-4 min-w-[100px]",
				sm: "h-9 px-4 py-2 native:h-11 native:px-5 native:py-3 min-w-[80px] rounded-md",
				lg: "h-14 px-8 py-4 native:h-16 native:px-10 native:py-5 min-w-[120px] rounded-xl",
				icon: "h-12 w-12 native:h-14 native:w-14 rounded-xl shadow-md",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

const buttonTextVariants = cva(
	"web:whitespace-nowrap text-sm native:text-base font-semibold text-foreground web:transition-all web:duration-200 web:ease-in-out",
	{
		variants: {
			variant: {
				default: "text-primary-foreground font-semibold tracking-wide",
				destructive: "text-destructive-foreground font-semibold tracking-wide",
				outline: "text-primary font-semibold group-active:text-primary group-hover:text-primary/90",
				secondary:
					"text-secondary-foreground font-semibold group-active:text-secondary-foreground/90",
				ghost: "text-foreground font-medium group-active:text-accent-foreground group-hover:text-foreground/90",
				link: "text-primary font-medium group-active:underline group-hover:text-primary/90 underline-offset-2",
			},
			size: {
				default: "text-sm native:text-base",
				sm: "text-xs native:text-sm",
				lg: "text-base native:text-lg font-bold tracking-wide",
				icon: "text-sm native:text-base",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

type ButtonProps = React.ComponentPropsWithoutRef<typeof Pressable> &
	VariantProps<typeof buttonVariants>;

const Button = React.forwardRef<
	React.ComponentRef<typeof Pressable>,
	ButtonProps
>(({ className, variant, size, ...props }, ref) => {
	return (
		<TextClassContext.Provider
			value={buttonTextVariants({
				variant,
				size,
				className: "web:pointer-events-none",
			})}
		>
			<Pressable
				className={cn(
					props.disabled && "opacity-50 web:pointer-events-none web:cursor-not-allowed web:hover:scale-100 web:hover:shadow-none",
					buttonVariants({ variant, size, className }),
				)}
				ref={ref}
				role="button"
				{...props}
			/>
		</TextClassContext.Provider>
	);
});
Button.displayName = "Button";

export { Button, buttonTextVariants, buttonVariants };
export type { ButtonProps };
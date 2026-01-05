import { Button } from "@/components/ui/button";
export function ContactButton({ className }: { className?: string }) {
	return (
		<div>
			<Button variant="default" className={className}>
				Contact Us
			</Button>
		</div>
	);
}

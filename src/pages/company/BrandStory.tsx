import { motion } from 'framer-motion';
import { ImageWithFallback } from '../../components/figma/ImageWithFallback';

export function BrandStory() {
  return (
    <section className="py-20 bg-muted/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="space-y-8"
          >
            <div>
              <h2 className="font-serif-premium text-4xl sm:text-5xl text-foreground mb-4">
                Heritage & 
                <br />
                <span className="text-transparent bg-clip-text gold-gradient">Craftsmanship</span>
              </h2>
              <div className="w-16 h-px bg-accent mb-6"></div>
            </div>

            <div className="space-y-6 font-sans-premium text-muted-foreground leading-relaxed">
              <p className="text-lg text-foreground/90">
                For over two centuries, our master craftsmen have perfected the art of tobacco curation, 
                selecting only the finest leaves from the most prestigious plantations around the world.
              </p>
              
              <p>
                Each blend in our collection represents a culmination of traditional techniques passed down 
                through generations, combined with innovative aging processes that enhance the natural 
                complexity and depth of flavor.
              </p>

              <p>
                From the sun-drenched fields of Virginia to the volcanic soils of Cuba, we source our tobacco 
                from regions where climate, soil, and expertise converge to create something truly exceptional.
              </p>
            </div>

            {/* Heritage Stats */}
            <div className="grid grid-cols-3 gap-8 pt-8 border-t border-border/20">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="text-center group"
              >
                <div className="font-serif-premium text-3xl text-accent mb-2 group-hover:scale-110 transition-transform">1847</div>
                <div className="font-sans-premium text-sm text-muted-foreground">Est. Founded</div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="text-center group"
              >
                <div className="font-serif-premium text-3xl text-accent mb-2 group-hover:scale-110 transition-transform">15</div>
                <div className="font-sans-premium text-sm text-muted-foreground">Master Blenders</div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.6, duration: 0.6 }}
                className="text-center group"
              >
                <div className="font-serif-premium text-3xl text-accent mb-2 group-hover:scale-110 transition-transform">47</div>
                <div className="font-sans-premium text-sm text-muted-foreground">Signature Blends</div>
              </motion.div>
            </div>
          </motion.div>

          {/* Image */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative"
          >
            <div className="relative group">
              <ImageWithFallback
                src="https://images.unsplash.com/photo-1605829897670-7ff48c43ef93?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0b2JhY2NvJTIwbGVhZiUyMHZpbnRhZ2UlMjBjcmFmdHNtYW5zaGlwfGVufDF8fHx8MTc1NzYwMDY4MXww&ixlib=rb-4.1.0&q=80&w=1080"
                alt="Tobacco craftsmanship"
                className="w-full aspect-[4/5] object-cover rounded-lg group-hover:scale-105 transition-transform duration-500"
              />
              
              {/* Decorative elements */}
              <div className="absolute -top-4 -left-4 w-20 h-20 border-l-2 border-t-2 border-accent opacity-60 group-hover:opacity-100 transition-opacity"></div>
              <div className="absolute -bottom-4 -right-4 w-20 h-20 border-r-2 border-b-2 border-accent opacity-60 group-hover:opacity-100 transition-opacity"></div>
            </div>

            {/* Quote overlay */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="absolute -bottom-8 -left-8 glass-card p-6 shadow-lg max-w-xs border border-border/20 rounded-lg"
            >
              <blockquote className="font-serif-premium text-foreground italic text-lg leading-relaxed">
                "Excellence is never an accident. It is the result of dedication, sincere effort, and skilled execution."
              </blockquote>
              <cite className="font-sans-premium text-sm text-muted-foreground mt-2 block">
                — Master Craftsman, 1892
              </cite>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

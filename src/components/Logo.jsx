// Inline SVG logo — no background rect, fill driven by CSS color (currentColor)
export default function Logo({ className, style }) {
  return (
    <svg
      viewBox="0 0 2000 2000"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ fillRule: 'evenodd', clipRule: 'evenodd', ...style }}
      aria-hidden="true"
    >
      <g transform="matrix(9.569708,0,0,9.569708,-9288.81196,-2180.98866)">
        <g transform="matrix(1.781555,0,0,1.781555,686.770269,217.844485)">
          <path d="M190.943,100L200.585,85.137L235.369,85.137L244.989,100L190.943,100Z" fill="currentColor"/>
        </g>
        <g transform="matrix(0.327052,0,-0,0.327052,-12.993443,-501.931781)">
          <path d="M3234.434,2661.227L3419.577,2661.227L3327.111,2518.373L3234.434,2661.227Z" fill="currentColor"/>
        </g>
        <g transform="matrix(0.327052,0,-0,0.327052,-12.993443,-501.931781)">
          <path d="M3275.379,2589.8L3179.74,2589.8L3179.74,2465.681L3412.422,2465.681C3446.673,2465.681 3474.481,2493.489 3474.481,2527.74C3474.481,2561.992 3446.673,2589.8 3412.422,2589.8L3391.355,2589.8L3338.987,2508.671L3327.641,2508.671L3275.379,2589.8Z" fill="currentColor"/>
        </g>
        <g transform="matrix(0.327052,0,-0,0.327052,-12.993443,-501.931781)">
          <path d="M3395.025,2356.617C3424.106,2356.617 3447.717,2380.227 3447.717,2409.309C3447.717,2438.39 3424.106,2462.001 3395.025,2462.001L3179.74,2462.001L3179.74,2356.617L3395.025,2356.617Z" fill="currentColor"/>
        </g>
      </g>
    </svg>
  )
}
